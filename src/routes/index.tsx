/* global google */

import { importLibrary, setOptions } from "@googlemaps/js-api-loader";
import { createFileRoute, redirect } from "@tanstack/react-router";
import * as React from "react";

import { fetchAuthMe } from "#/lib/fetch-auth-me";
import {
  COLLECTION_PROXIMITY_METERS,
  findCollectionNear,
} from "#/lib/geo-dedupe";

type DomainVertex = { idx: number; lat: number; lng: number };

type CollectionRow = {
  id: string;
  name: string;
  memo: string;
  lat: number;
  lng: number;
  createdAt: string;
  updatedAt: string;
};

async function fetchDomain(): Promise<{ vertices: DomainVertex[] }> {
  const res = await fetch("/api/domain", { credentials: "include" });
  if (!res.ok) throw new Error("載入領域失敗");
  return res.json() as Promise<{ vertices: DomainVertex[] }>;
}

async function fetchCollections(): Promise<CollectionRow[]> {
  const res = await fetch("/api/collections", { credentials: "include" });
  if (!res.ok) throw new Error("載入收藏失敗");
  const data = (await res.json()) as { collections: CollectionRow[] };
  return data.collections;
}

function formatCollectionCreatedAt(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return new Intl.DateTimeFormat("zh-TW", {
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(d);
  } catch {
    return iso;
  }
}

function createMarkerIconElement(): HTMLElement {
  const wrapper = document.createElement("div");
  wrapper.className = "custom-map-marker";
  wrapper.style.transform = "translateY(-4px)";
  const img = document.createElement("img");
  img.src = "/apple-touch-icon.png";
  img.alt = "";
  img.width = 36;
  img.height = 36;
  img.style.display = "block";
  img.style.width = "36px";
  img.style.height = "36px";
  img.style.borderRadius = "9999px";
  img.style.border = "2px solid #ffffff";
  img.style.boxShadow = "0 4px 10px rgba(0, 0, 0, 0.25)";
  wrapper.appendChild(img);
  return wrapper;
}

function readMapPolygonColors(): { stroke: string; fill: string } {
  const root = document.documentElement;
  const stroke = getComputedStyle(root)
    .getPropertyValue("--map-polygon-stroke")
    .trim();
  const fill = getComputedStyle(root)
    .getPropertyValue("--map-polygon-fill")
    .trim();
  return {
    stroke: stroke || "#00b8d4",
    fill: fill || "#00e5ff",
  };
}

export const Route = createFileRoute("/")({
  beforeLoad: async () => {
    const res = await fetchAuthMe();
    const data = (await res.json()) as { authenticated?: boolean };
    if (!data.authenticated) {
      throw redirect({ to: "/login" });
    }
  },
  component: DomainPage,
});

function DomainPage() {
  const [vertices, setVertices] = React.useState<DomainVertex[]>([]);
  const [secret, setSecret] = React.useState("");
  const [collections, setCollections] = React.useState<CollectionRow[]>([]);
  const [collectionsError, setCollectionsError] = React.useState<string | null>(
    null,
  );
  const [modalId, setModalId] = React.useState<string | null>(null);
  const [modalName, setModalName] = React.useState("");
  const [modalMemo, setModalMemo] = React.useState("");
  const [modalBusy, setModalBusy] = React.useState(false);
  const [modalError, setModalError] = React.useState<string | null>(null);
  const [addBusy, setAddBusy] = React.useState(false);
  const [collectionsDrawerOpen, setCollectionsDrawerOpen] =
    React.useState(false);
  const [deleteBusy, setDeleteBusy] = React.useState(false);
  const [mapStyleTick, setMapStyleTick] = React.useState(0);

  React.useEffect(() => {
    const bump = () => setMapStyleTick((n) => n + 1);
    const root = document.documentElement;
    const obs = new MutationObserver(bump);
    obs.observe(root, {
      attributes: true,
      attributeFilter: ["class", "data-theme"],
    });
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    mq.addEventListener("change", bump);
    return () => {
      obs.disconnect();
      mq.removeEventListener("change", bump);
    };
  }, []);
  const [vertexSettingsOpen, setVertexSettingsOpen] = React.useState(false);

  const mapDivRef = React.useRef<HTMLDivElement | null>(null);
  const searchBoxRef = React.useRef<HTMLDivElement | null>(null);
  const mapRef = React.useRef<google.maps.Map | null>(null);
  const polygonRef = React.useRef<google.maps.Polygon | null>(null);
  const markerRef =
    React.useRef<google.maps.marker.AdvancedMarkerElement | null>(null);
  const collectionMarkersRef = React.useRef<
    Map<string, google.maps.marker.AdvancedMarkerElement>
  >(new Map());
  const collectionMarkerAbortRef = React.useRef<Map<string, AbortController>>(
    new Map(),
  );
  const collectionsRef = React.useRef<CollectionRow[]>([]);

  const [mapsReady, setMapsReady] = React.useState(false);
  const [placeResult, setPlaceResult] = React.useState<{
    name: string;
    lat: number;
    lng: number;
    inside: boolean;
  } | null>(null);

  const googleMapsApiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as
    | string
    | undefined;

  const matchedCollection = React.useMemo(() => {
    if (!placeResult) return undefined;
    return findCollectionNear(
      placeResult.lat,
      placeResult.lng,
      collections,
      COLLECTION_PROXIMITY_METERS,
    );
  }, [placeResult, collections]);

  const openCollectionModal = React.useCallback((c: CollectionRow) => {
    setModalId(c.id);
    setModalName(c.name);
    setModalMemo(c.memo);
    setModalError(null);
    mapRef.current?.panTo({ lat: c.lat, lng: c.lng });
  }, []);

  const openCollectionModalRef = React.useRef(openCollectionModal);
  openCollectionModalRef.current = openCollectionModal;

  const openCollectionFromDrawer = React.useCallback(
    (c: CollectionRow) => {
      openCollectionModal(c);
      setCollectionsDrawerOpen(false);
    },
    [openCollectionModal],
  );

  React.useEffect(() => {
    collectionsRef.current = collections;
  }, [collections]);

  React.useEffect(() => {
    void fetchDomain()
      .then((data) => setVertices(data.vertices))
      .catch(() => {
        setVertices([]);
      });
  }, []);

  React.useEffect(() => {
    void fetchCollections()
      .then(setCollections)
      .catch(() => {
        setCollectionsError("無法載入收藏");
        setCollections([]);
      });
  }, []);

  React.useEffect(() => {
    if (!collectionsDrawerOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setCollectionsDrawerOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [collectionsDrawerOpen]);

  React.useEffect(() => {
    if (!collectionsDrawerOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [collectionsDrawerOpen]);

  React.useEffect(() => {
    let cancelled = false;

    async function init() {
      if (!googleMapsApiKey) return;
      if (!mapDivRef.current) return;

      setOptions({
        key: googleMapsApiKey,
        v: "weekly",
      });

      await importLibrary("maps");
      await window.google.maps.importLibrary("places");
      await window.google.maps.importLibrary("marker");
      if (cancelled) return;

      const center = vertices[0]
        ? { lat: vertices[0].lat, lng: vertices[0].lng }
        : { lat: 0, lng: 0 };

      const map = new window.google.maps.Map(mapDivRef.current, {
        center,
        zoom: 14,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
        mapId: import.meta.env.VITE_GOOGLE_MAPS_ID,
      });

      mapRef.current = map;
      setMapsReady(true);
    }

    void init();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [googleMapsApiKey]);

  React.useEffect(() => {
    if (!mapsReady) return;
    if (!mapRef.current) return;

    const path = vertices
      .slice()
      .sort((a, b) => a.idx - b.idx)
      .map((v) => ({ lat: v.lat, lng: v.lng }));

    polygonRef.current?.setMap(null);
    const { stroke, fill } = readMapPolygonColors();
    polygonRef.current = new window.google.maps.Polygon({
      paths: path,
      strokeColor: stroke,
      strokeOpacity: 0.95,
      strokeWeight: 2.5,
      fillColor: fill,
      fillOpacity: 0.28,
      clickable: false,
    });
    polygonRef.current.setMap(mapRef.current);

    if (path[0]) {
      mapRef.current.panTo(path[0]);
    }

    return () => {
      polygonRef.current?.setMap(null);
      polygonRef.current = null;
    };
  }, [mapsReady, vertices, mapStyleTick]);

  React.useEffect(() => {
    if (!mapsReady) return;
    if (!mapRef.current) return;

    const map = mapRef.current;
    const markers = collectionMarkersRef.current;
    const nextIds = new Set(collections.map((c) => c.id));

    const aborts = collectionMarkerAbortRef.current;

    for (const [id, m] of markers) {
      if (!nextIds.has(id)) {
        aborts.get(id)?.abort();
        aborts.delete(id);
        m.map = null;
        markers.delete(id);
      }
    }

    for (const c of collections) {
      let m = markers.get(c.id);
      if (!m) {
        m = new window.google.maps.marker.AdvancedMarkerElement({
          map,
          position: { lat: c.lat, lng: c.lng },
          title: c.name,
          gmpClickable: true,
          content: createMarkerIconElement(),
        });
        const id = c.id;
        const ac = new AbortController();
        aborts.set(id, ac);
        m.addEventListener(
          "gmp-click",
          () => {
            const row = collectionsRef.current.find((x) => x.id === id);
            if (!row) return;
            openCollectionModalRef.current(row);
          },
          { signal: ac.signal },
        );
        markers.set(c.id, m);
      } else {
        m.position = { lat: c.lat, lng: c.lng };
        m.title = c.name;
      }
    }

    return () => {
      for (const [id, m] of markers) {
        aborts.get(id)?.abort();
        aborts.delete(id);
        m.map = null;
      }
      markers.clear();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- full resync when mapsReady flips
  }, [mapsReady, collections]);

  React.useEffect(() => {
    if (!mapsReady) return;
    if (!mapRef.current) return;
    if (!searchBoxRef.current) return;

    let cancelled = false;
    let el: HTMLElement | null = null;

    const onPlaceSelect = async (event: Event) => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { placePrediction } = event as any;
        if (!placePrediction) return;

        const place = (
          placePrediction as google.maps.places.PlacePrediction
        ).toPlace();
        await place.fetchFields({ fields: ["displayName", "location"] });

        const loc = place.location;
        const polygon = polygonRef.current;
        if (!loc || !polygon) return;

        const lat = loc.lat();
        const lng = loc.lng();

        await Promise.all([
          window.google.maps.importLibrary("geometry"),
          window.google.maps.importLibrary("marker"),
        ]);

        const inside = window.google.maps.geometry.poly.containsLocation(
          loc,
          polygon,
        );

        if (markerRef.current) {
          markerRef.current.map = null;
        }
        markerRef.current = new window.google.maps.marker.AdvancedMarkerElement(
          {
            map: mapRef.current!,
            position: { lat, lng },
            title: place.displayName ?? "結果",
            content: createMarkerIconElement(),
          },
        );

        mapRef.current!.panTo({ lat, lng });

        setPlaceResult({
          name: place.displayName ?? "結果",
          lat,
          lng,
          inside,
        });
      } catch (err) {
        console.error("Place selection failed", err);
      }
    };

    void (async () => {
      await window.google.maps.importLibrary("places");
      if (cancelled) return;
      if (!searchBoxRef.current) return;

      el = new window.google.maps.places.PlaceAutocompleteElement(
        {},
      ) as unknown as HTMLElement;
      (el as unknown as { placeholder: string }).placeholder = "搜尋地點…";
      (el as HTMLElement).style.width = "100%";
      (el as HTMLElement).style.maxWidth = "100%";
      (el as HTMLElement).style.boxSizing = "border-box";

      searchBoxRef.current.replaceChildren(el);

      el.addEventListener("gmp-select", onPlaceSelect);
    })();

    return () => {
      cancelled = true;
      el?.removeEventListener("gmp-select", onPlaceSelect);
      if (markerRef.current) {
        markerRef.current.map = null;
      }
      markerRef.current = null;
    };
  }, [mapsReady]);

  async function saveVertex(idx: number, lat: number, lng: number) {
    const res = await fetch(`/api/domain/vertex/${idx}`, {
      method: "PUT",
      credentials: "include",
      headers: {
        "content-type": "application/json",
        "x-domain-secret": secret,
      },
      body: JSON.stringify({ lat, lng }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(text || "儲存座標失敗");
    }
    const data = (await res.json()) as { vertices: DomainVertex[] };
    setVertices(data.vertices);
  }

  async function addCollectionFromPlace() {
    if (!placeResult) return;
    setAddBusy(true);
    try {
      const res = await fetch("/api/collections", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: placeResult.name,
          memo: "",
          lat: placeResult.lat,
          lng: placeResult.lng,
        }),
      });
      if (!res.ok) {
        if (res.status === 409) {
          const data = (await res.json().catch(() => null)) as {
            error?: string;
          } | null;
          throw new Error(data?.error ?? "此位置附近已有收藏");
        }
        const t = await res.text().catch(() => "");
        throw new Error(t || "加入收藏失敗");
      }
      setCollections(await fetchCollections());
      setCollectionsError(null);
    } catch (e) {
      setCollectionsError(e instanceof Error ? e.message : "加入收藏失敗");
    } finally {
      setAddBusy(false);
    }
  }

  async function saveModal() {
    if (!modalId) return;
    setModalBusy(true);
    setModalError(null);
    try {
      const res = await fetch(`/api/collections/${modalId}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: modalName, memo: modalMemo }),
      });
      if (!res.ok) {
        const t = await res.text().catch(() => "");
        throw new Error(t || "儲存失敗");
      }
      setCollections(await fetchCollections());
      setModalId(null);
    } catch (e) {
      setModalError(e instanceof Error ? e.message : "儲存失敗");
    } finally {
      setModalBusy(false);
    }
  }

  async function deleteCollection() {
    if (!modalId) return;
    if (!window.confirm("確定要移除這筆收藏？")) return;
    setDeleteBusy(true);
    setModalError(null);
    try {
      const res = await fetch(`/api/collections/${modalId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        const t = await res.text().catch(() => "");
        throw new Error(t || "移除失敗");
      }
      setCollections(await fetchCollections());
      setModalId(null);
    } catch (e) {
      setModalError(e instanceof Error ? e.message : "移除失敗");
    } finally {
      setDeleteBusy(false);
    }
  }

  async function logout() {
    await fetch("/api/auth/logout", {
      method: "POST",
      credentials: "include",
    });
    window.location.href = "/login";
  }

  const modalCollection = modalId
    ? collections.find((c) => c.id === modalId)
    : null;

  return (
    <main className="page-wrap md:px-4 pb-10 pt-10">
      <section className="island-shell rounded-[2rem] p-6 sm:p-8">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="display-title m-0 text-3xl font-bold text-[var(--sea-ink)] sm:text-4xl">
              領域展開
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-7 text-[var(--sea-ink-soft)] sm:text-base">
              我們都會想要知道現在的位置是否在領域內。
            </p>
          </div>
          <button
            type="button"
            onClick={() => void logout()}
            className="shrink-0 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-4 py-2 text-sm font-semibold text-[var(--sea-ink)] hover:bg-[var(--surface-strong)]"
          >
            登出
          </button>
        </div>

        <div className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
          <div className="min-w-0 space-y-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="w-full">
                <label className="text-xs font-semibold tracking-wide text-[var(--sea-ink-soft)]">
                  地點搜尋
                </label>
                <div
                  ref={searchBoxRef}
                  className="mt-1 w-full rounded-xl border border-[var(--line)] bg-[var(--surface-strong)] px-3 py-2 text-sm text-[var(--sea-ink)] shadow-[0_10px_30px_var(--shadow-soft)] outline-none focus-within:border-[var(--focus-ring)]"
                />
              </div>
            </div>

            {placeResult ? (
              matchedCollection ? (
                <button
                  type="button"
                  onClick={() => openCollectionModal(matchedCollection)}
                  className="w-full rounded-2xl border border-[var(--border-cta-stronger)] bg-[var(--surface)] p-4 text-left text-sm shadow-[0_8px_24px_var(--shadow-soft)] transition hover:bg-[color-mix(in_oklab,var(--surface-strong)_88%,white_12%)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-semibold text-[var(--sea-ink)]">
                        {placeResult.name}
                      </div>
                      <div className="text-[var(--sea-ink-soft)]">
                        {placeResult.lat.toFixed(6)},{" "}
                        {placeResult.lng.toFixed(6)}
                      </div>
                      <div className="mt-1 text-xs text-[var(--sea-ink-soft)]">
                        收藏於{" "}
                        {formatCollectionCreatedAt(matchedCollection.createdAt)}
                      </div>
                      <div className="mt-2 inline-block rounded-full bg-[var(--fill-badge)] px-2.5 py-0.5 text-xs font-semibold text-[var(--lagoon-deep)]">
                        已在收藏 · 點此編輯
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <div
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${
                          placeResult.inside
                            ? "bg-[var(--tag-positive-bg)] text-[var(--palm)]"
                            : "bg-[var(--tag-neutral-bg)] text-[var(--sea-ink-soft)]"
                        }`}
                      >
                        {placeResult.inside
                          ? "在領域內QQ"
                          : "不在領域內，恭喜！"}
                      </div>
                      <span className="rounded-xl border border-[var(--border-cta-strong)] bg-[var(--fill-badge-strong)] px-3 py-1.5 text-xs font-semibold text-[var(--lagoon-deep)]">
                        編輯收藏
                      </span>
                    </div>
                  </div>
                </button>
              ) : (
                <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-semibold text-[var(--sea-ink)]">
                        {placeResult.name}
                      </div>
                      <div className="text-[var(--sea-ink-soft)]">
                        {placeResult.lat.toFixed(6)},{" "}
                        {placeResult.lng.toFixed(6)}
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <div
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${
                          placeResult.inside
                            ? "bg-[var(--tag-positive-bg)] text-[var(--palm)]"
                            : "bg-[var(--tag-neutral-bg)] text-[var(--sea-ink-soft)]"
                        }`}
                      >
                        {placeResult.inside
                          ? "在領域內QQ"
                          : "不在領域內，恭喜！"}
                      </div>
                      <button
                        type="button"
                        disabled={addBusy}
                        onClick={() => void addCollectionFromPlace()}
                        className="rounded-xl border border-[var(--border-cta-strong)] bg-[var(--fill-badge-strong)] px-3 py-1.5 text-xs font-semibold text-[var(--lagoon-deep)] hover:bg-[var(--fill-badge-hover)] disabled:opacity-60"
                      >
                        {addBusy ? "加入中…" : "加入收藏"}
                      </button>
                    </div>
                  </div>
                </div>
              )
            ) : (
              <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4 text-sm text-[var(--sea-ink-soft)]">
                選擇搜尋結果後，會顯示是否位於領域內。
              </div>
            )}

            <div
              ref={mapDivRef}
              className="h-[460px] w-full overflow-hidden rounded-2xl border border-[var(--line)] bg-[color-mix(in_oklab,var(--foam)_78%,var(--bg-base))] shadow-[0_18px_40px_var(--shadow-medium)]"
            />

            {!googleMapsApiKey ? (
              <div className="rounded-2xl border border-[var(--line)] bg-[var(--panel-muted-bg)] p-4 text-sm text-[var(--sea-ink-soft)]">
                缺少 <code>VITE_GOOGLE_MAPS_API_KEY</code>。請加入{" "}
                <code>.env</code> 並重新啟動開發伺服器。
              </div>
            ) : null}
          </div>

          <aside className="min-w-0 space-y-3">
            {collectionsError ? (
              <div className="rounded-2xl border border-[var(--panel-muted-border)] bg-[var(--panel-muted-bg)] p-3 text-sm text-[var(--sea-ink-soft)]">
                {collectionsError}
              </div>
            ) : null}

            <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-[var(--sea-ink)]">
                    收藏
                  </div>
                  <p className="mt-1 text-sm leading-6 text-[var(--sea-ink-soft)]">
                    搜尋後可加入；地圖標記與清單可編輯名稱與備註。
                  </p>
                </div>
                <div
                  className="shrink-0 rounded-full border border-[var(--pill-border-soft)] bg-[var(--glass-strong)] px-3 py-1 text-xs font-bold tabular-nums text-[var(--sea-ink)]"
                  aria-label={`共 ${collections.length} 筆收藏`}
                >
                  {collections.length} 筆
                </div>
              </div>
              <button
                type="button"
                onClick={() => setCollectionsDrawerOpen(true)}
                className="mt-4 w-full rounded-xl border border-[var(--border-cta-strong)] bg-[var(--fill-cta-ghost)] px-4 py-2.5 text-sm font-semibold text-[var(--lagoon-deep)] transition hover:bg-[var(--fill-cta-ghost-hover)]"
              >
                開啟清單
              </button>
            </div>

            <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)]">
              <button
                type="button"
                id="vertex-settings-toggle"
                aria-expanded={vertexSettingsOpen}
                aria-controls="vertex-settings-panel"
                onClick={() => setVertexSettingsOpen((o) => !o)}
                className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left transition hover:bg-[color-mix(in_oklab,var(--surface-strong)_55%,transparent)]"
              >
                <span className="text-sm font-semibold text-[var(--sea-ink)]">
                  {vertexSettingsOpen ? "收合設定" : "展開設定"}
                </span>
                <span className="text-[var(--sea-ink-soft)]" aria-hidden>
                  {vertexSettingsOpen ? "▲" : "▼"}
                </span>
              </button>
              <div
                id="vertex-settings-panel"
                role="region"
                aria-labelledby="vertex-settings-toggle"
                hidden={!vertexSettingsOpen}
                className={
                  vertexSettingsOpen
                    ? "border-t border-[var(--line)] px-5 pb-5 pt-2"
                    : ""
                }
              >
                <VertexEditor
                  vertices={vertices}
                  onSave={(idx, lat, lng) => saveVertex(idx, lat, lng)}
                  secret={secret}
                  setSecret={setSecret}
                />
              </div>
            </div>
          </aside>
        </div>
      </section>

      {collectionsDrawerOpen ? (
        <div className="fixed inset-0 z-40 flex justify-end">
          <div
            className="absolute inset-0 bg-[var(--overlay-backdrop)]"
            role="presentation"
            onClick={() => setCollectionsDrawerOpen(false)}
          />
          <aside
            className="relative flex h-full w-full max-w-md flex-col border-l border-[var(--line)] bg-[var(--surface)] shadow-[-12px_0_40px_var(--shadow-strong)]"
            role="dialog"
            aria-modal="true"
            aria-labelledby="collections-drawer-title"
          >
            <div className="flex items-center justify-between gap-3 border-b border-[var(--line)] px-4 py-4">
              <h2
                id="collections-drawer-title"
                className="text-lg font-bold text-[var(--sea-ink)]"
              >
                收藏清單
              </h2>
              <button
                type="button"
                onClick={() => setCollectionsDrawerOpen(false)}
                className="rounded-lg border border-[var(--line)] bg-[var(--surface-strong)] px-2.5 py-1 text-sm font-semibold text-[var(--sea-ink)] hover:bg-[var(--surface-hover)]"
                aria-label="關閉"
              >
                ×
              </button>
            </div>
            <ul className="flex-1 space-y-2 overflow-y-auto p-4 pr-3">
              {collections.length === 0 ? (
                <li className="text-sm text-[var(--sea-ink-soft)]">尚無收藏</li>
              ) : (
                collections.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => openCollectionFromDrawer(c)}
                      className="w-full rounded-xl border border-[var(--divider-faint)] bg-[var(--glass-soft)] px-3 py-2 text-left text-sm transition hover:border-[var(--border-cta-strong)]"
                    >
                      <div className="font-semibold text-[var(--sea-ink)]">
                        {c.name}
                      </div>
                      <div className="mt-0.5 text-xs tabular-nums text-[var(--sea-ink-soft)]">
                        加入於 {formatCollectionCreatedAt(c.createdAt)}
                      </div>
                      {c.memo ? (
                        <div className="mt-0.5 line-clamp-2 text-xs text-[var(--sea-ink-soft)]">
                          {c.memo}
                        </div>
                      ) : null}
                    </button>
                  </li>
                ))
              )}
            </ul>
          </aside>
        </div>
      ) : null}

      {modalCollection ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--overlay-backdrop)] p-4"
          role="presentation"
          onClick={() => setModalId(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="collection-modal-title"
            className="w-full max-w-md rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5 shadow-[0_24px_60px_var(--shadow-modal)]"
            onClick={(e) => e.stopPropagation()}
          >
            <h2
              id="collection-modal-title"
              className="text-lg font-bold text-[var(--sea-ink)]"
            >
              收藏詳情
            </h2>
            <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs text-[var(--sea-ink-soft)]">
                {modalCollection.lat.toFixed(6)},{" "}
                {modalCollection.lng.toFixed(6)} （唯讀）
              </p>
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${modalCollection.lat},${modalCollection.lng}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 rounded-full border border-[var(--border-cta-strong)] bg-[var(--fill-badge-strong)] px-2.5 py-1 text-xs font-semibold text-[var(--lagoon-deep)] transition hover:bg-[var(--fill-badge-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]"
              >
                在 Google Maps 開啟
                <span aria-hidden>↗</span>
              </a>
            </div>
            <p className="mt-1 text-xs text-[var(--sea-ink-soft)]">
              加入於 {formatCollectionCreatedAt(modalCollection.createdAt)}
            </p>
            {modalError ? (
              <div className="mt-3 rounded-xl border border-[var(--panel-muted-border)] bg-[var(--panel-muted-bg)] px-3 py-2 text-sm text-[var(--sea-ink-soft)]">
                {modalError}
              </div>
            ) : null}
            <label className="mt-4 block text-xs font-semibold tracking-wide text-[var(--sea-ink-soft)]">
              名稱
              <input
                value={modalName}
                onChange={(e) => setModalName(e.target.value)}
                className="mt-1 w-full rounded-xl border border-[var(--line)] bg-[var(--surface-strong)] px-3 py-2 text-sm text-[var(--sea-ink)] outline-none focus:border-[var(--focus-ring)]"
              />
            </label>
            <label className="mt-3 block text-xs font-semibold tracking-wide text-[var(--sea-ink-soft)]">
              備註
              <textarea
                value={modalMemo}
                onChange={(e) => setModalMemo(e.target.value)}
                rows={4}
                className="mt-1 w-full resize-y rounded-xl border border-[var(--line)] bg-[var(--surface-strong)] px-3 py-2 text-sm text-[var(--sea-ink)] outline-none focus:border-[var(--focus-ring)]"
              />
            </label>
            <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
              <button
                type="button"
                disabled={deleteBusy || modalBusy}
                onClick={() => void deleteCollection()}
                className="rounded-xl border border-[var(--danger-border)] bg-[var(--danger-bg)] px-4 py-2 text-sm font-semibold text-[var(--danger-text)] hover:bg-[var(--danger-bg-hover)] disabled:opacity-60"
              >
                {deleteBusy ? "移除中…" : "移除收藏"}
              </button>
              <div className="flex flex-wrap justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setModalId(null)}
                  className="rounded-xl border border-[var(--line)] bg-[var(--surface-strong)] px-4 py-2 text-sm font-semibold text-[var(--sea-ink)]"
                >
                  取消
                </button>
                <button
                  type="button"
                  disabled={modalBusy}
                  onClick={() => void saveModal()}
                  className="rounded-xl border border-[var(--border-cta)] bg-[var(--fill-cta-ghost)] px-4 py-2 text-sm font-semibold text-[var(--lagoon-deep)] disabled:opacity-60"
                >
                  {modalBusy ? "儲存中…" : "儲存"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}

function VertexEditor(props: {
  vertices: DomainVertex[];
  onSave: (idx: number, lat: number, lng: number) => Promise<void>;
  secret: string;
  setSecret: (secret: string) => void;
}) {
  const ordered = props.vertices.slice().sort((a, b) => a.idx - b.idx);
  const [drafts, setDrafts] = React.useState(() =>
    ordered.map((v) => ({
      idx: v.idx,
      lat: String(v.lat),
      lng: String(v.lng),
    })),
  );
  const [busyIdx, setBusyIdx] = React.useState<number | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    setDrafts(
      ordered.map((v) => ({
        idx: v.idx,
        lat: String(v.lat),
        lng: String(v.lng),
      })),
    );
  }, [props.vertices]);

  return (
    <div>
      {error ? (
        <div className="mb-3 rounded-xl border border-[var(--panel-muted-border)] bg-[var(--panel-muted-bg)] px-3 py-2 text-sm text-[var(--sea-ink-soft)]">
          {error}
        </div>
      ) : null}

      <div className="mb-4 flex w-full flex-col gap-2 sm:w-[360px]">
        <label className="text-xs font-semibold tracking-wide text-[var(--sea-ink-soft)]">
          Update Secret
        </label>
        <input
          value={props.secret}
          onChange={(e) => props.setSecret(e.target.value)}
          placeholder="DOMAIN_SECRET"
          className="w-full rounded-xl border border-[var(--line)] bg-[var(--surface-strong)] px-3 py-2 text-sm text-[var(--sea-ink)] shadow-[0_10px_30px_var(--shadow-soft)] outline-none focus:border-[var(--focus-ring)]"
        />
      </div>

      <div className="space-y-3">
        {drafts.map((d) => (
          <div
            key={d.idx}
            className="rounded-2xl border border-[var(--pill-border-soft)] bg-[var(--glass-soft)] p-3"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm font-semibold text-[var(--sea-ink)]">
                頂點 {d.idx}
              </div>
              <button
                type="button"
                disabled={busyIdx === d.idx}
                onClick={() => {
                  setError(null);
                  const lat = Number(d.lat);
                  const lng = Number(d.lng);
                  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
                    setError("經緯度必須是數字。");
                    return;
                  }
                  setBusyIdx(d.idx);
                  props
                    .onSave(d.idx, lat, lng)
                    .catch((e: unknown) => {
                      setError(e instanceof Error ? e.message : "儲存座標失敗");
                    })
                    .finally(() => setBusyIdx(null));
                }}
                className="rounded-xl border border-[var(--border-cta)] bg-[var(--fill-cta-ghost)] px-3 py-1.5 text-xs font-semibold text-[var(--lagoon-deep)] transition hover:-translate-y-0.5 hover:bg-[var(--fill-cta-ghost-hover)] disabled:opacity-60 disabled:hover:translate-y-0"
              >
                {busyIdx === d.idx ? "儲存中…" : "儲存"}
              </button>
            </div>

            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <label className="text-xs font-semibold tracking-wide text-[var(--sea-ink-soft)]">
                Lat
                <input
                  value={d.lat}
                  onChange={(e) =>
                    setDrafts((prev) =>
                      prev.map((p) =>
                        p.idx === d.idx ? { ...p, lat: e.target.value } : p,
                      ),
                    )
                  }
                  className="mt-1 w-full rounded-xl border border-[var(--line)] bg-[var(--surface-strong)] px-3 py-2 text-sm text-[var(--sea-ink)] outline-none focus:border-[var(--focus-ring)]"
                />
              </label>
              <label className="text-xs font-semibold tracking-wide text-[var(--sea-ink-soft)]">
                Lng
                <input
                  value={d.lng}
                  onChange={(e) =>
                    setDrafts((prev) =>
                      prev.map((p) =>
                        p.idx === d.idx ? { ...p, lng: e.target.value } : p,
                      ),
                    )
                  }
                  className="mt-1 w-full rounded-xl border border-[var(--line)] bg-[var(--surface-strong)] px-3 py-2 text-sm text-[var(--sea-ink)] outline-none focus:border-[var(--focus-ring)]"
                />
              </label>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
