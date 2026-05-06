import "dotenv/config";
import { db, pool } from "./client";
import { domainVertices } from "./schema";

// 25.062868,121.5171464 民權西路
// 25.05748,121.5084087 迪化街
// 25.0441615,121.5137436 台大醫院
// 25.0468186,121.5209947 南京復興

// A small default polygon (Taipei-ish) so the map has something to show.
const DEFAULT_VERTICES: Array<{ idx: number; lat: number; lng: number }> = [
  { idx: 0, lat: 25.062868, lng: 121.5171464 },
  { idx: 1, lat: 25.05748, lng: 121.5084087 },
  { idx: 2, lat: 25.0441615, lng: 121.5137436 },
  { idx: 3, lat: 25.0468186, lng: 121.5209947 },
];

async function main() {
  for (const vertex of DEFAULT_VERTICES) {
    await db
      .insert(domainVertices)
      .values(vertex)
      .onConflictDoUpdate({
        target: domainVertices.idx,
        set: { lat: vertex.lat, lng: vertex.lng, updatedAt: new Date() },
      });
  }
}

main()
  .then(async () => {
    await pool.end();
  })
  .catch(async (err) => {
    console.error(err);
    await pool.end();
    process.exitCode = 1;
  });
