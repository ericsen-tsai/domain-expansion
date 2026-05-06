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

