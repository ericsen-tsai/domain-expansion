/**
 * Loaders/beforeLoad run during SSR where relative fetch URLs fail (no request origin).
 * Browser keeps cookie jars via credentials: "include"; SSR forwards the inbound Cookie header.
 */

import { createServerFn } from "@tanstack/react-start";

const getServerAuthMe = createServerFn().handler(async () => {
  const { getRequest, getRequestUrl } =
    await import("@tanstack/react-start/server");
  const url = new URL(
    "/api/auth/me",
    getRequestUrl({ xForwardedHost: true, xForwardedProto: true }),
  );
  const cookie = getRequest().headers.get("cookie");
  return fetch(url, {
    headers: cookie ? { cookie } : undefined,
  });
});

export async function fetchAuthMe(): Promise<Response> {
  if (import.meta.env.SSR) {
    return getServerAuthMe();
  }

  return fetch("/api/auth/me", { credentials: "include" });
}
