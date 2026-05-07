/** Max distance (meters) to treat two collection pins as the same place. */
export const COLLECTION_PROXIMITY_METERS = 45;

export function haversineMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6371000;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(Δφ / 2) ** 2 +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function findCollectionNear<T extends { lat: number; lng: number }>(
  lat: number,
  lng: number,
  rows: T[],
  maxMeters: number = COLLECTION_PROXIMITY_METERS,
): T | undefined {
  let best: T | undefined;
  let bestD = Infinity;
  for (const row of rows) {
    const d = haversineMeters(lat, lng, row.lat, row.lng);
    if (d <= maxMeters && d < bestD) {
      bestD = d;
      best = row;
    }
  }
  return best;
}
