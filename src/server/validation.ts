export function parseVertexIndex(raw: unknown): number {
  if (typeof raw !== 'string') {
    throw new Response('Invalid idx', { status: 400 })
  }

  const idx = Number(raw)
  if (!Number.isInteger(idx) || idx < 0 || idx > 3) {
    throw new Response('Invalid idx', { status: 400 })
  }
  return idx
}

export function parseLatLng(body: unknown): { lat: number; lng: number } {
  if (!body || typeof body !== 'object') {
    throw new Response('Invalid body', { status: 400 })
  }

  const lat = (body as { lat?: unknown }).lat
  const lng = (body as { lng?: unknown }).lng

  if (typeof lat !== 'number' || !Number.isFinite(lat)) {
    throw new Response('Invalid lat', { status: 400 })
  }

  if (typeof lng !== 'number' || !Number.isFinite(lng)) {
    throw new Response('Invalid lng', { status: 400 })
  }

  if (lat < -90 || lat > 90) {
    throw new Response('Invalid lat', { status: 400 })
  }

  if (lng < -180 || lng > 180) {
    throw new Response('Invalid lng', { status: 400 })
  }

  return { lat, lng }
}

const NAME_MAX = 200
const MEMO_MAX = 5000

export function parseCollectionCreate(body: unknown): {
  name: string
  memo: string
  lat: number
  lng: number
} {
  if (!body || typeof body !== 'object') {
    throw new Response('Invalid body', { status: 400 })
  }
  const o = body as Record<string, unknown>
  const { lat, lng } = parseLatLng(body)

  const nameRaw = o.name
  if (typeof nameRaw !== 'string') {
    throw new Response('Invalid name', { status: 400 })
  }
  const name = nameRaw.trim()
  if (name.length === 0 || name.length > NAME_MAX) {
    throw new Response('Invalid name', { status: 400 })
  }

  let memo = ''
  if (o.memo !== undefined) {
    if (typeof o.memo !== 'string') {
      throw new Response('Invalid memo', { status: 400 })
    }
    memo = o.memo
    if (memo.length > MEMO_MAX) {
      throw new Response('Invalid memo', { status: 400 })
    }
  }

  return { name, memo, lat, lng }
}

export function parseCollectionPatch(body: unknown): {
  name?: string
  memo?: string
} {
  if (!body || typeof body !== 'object') {
    throw new Response('Invalid body', { status: 400 })
  }
  const o = body as Record<string, unknown>
  const out: { name?: string; memo?: string } = {}

  if (o.name !== undefined) {
    if (typeof o.name !== 'string') {
      throw new Response('Invalid name', { status: 400 })
    }
    const name = o.name.trim()
    if (name.length === 0 || name.length > NAME_MAX) {
      throw new Response('Invalid name', { status: 400 })
    }
    out.name = name
  }

  if (o.memo !== undefined) {
    if (typeof o.memo !== 'string') {
      throw new Response('Invalid memo', { status: 400 })
    }
    if (o.memo.length > MEMO_MAX) {
      throw new Response('Invalid memo', { status: 400 })
    }
    out.memo = o.memo
  }

  if (out.name === undefined && out.memo === undefined) {
    throw new Response('Nothing to update', { status: 400 })
  }

  return out
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function parseCollectionId(raw: unknown): string {
  if (typeof raw !== 'string' || !UUID_RE.test(raw)) {
    throw new Response('Invalid id', { status: 400 })
  }
  return raw
}

