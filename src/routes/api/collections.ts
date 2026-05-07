import { createFileRoute } from '@tanstack/react-router'
import { desc } from 'drizzle-orm'

import { db } from '#/db/client'
import { collections } from '#/db/schema'
import { findCollectionNear } from '#/lib/geo-dedupe'
import { assertAppSession } from '#/server/app-session'
import { parseCollectionCreate } from '#/server/validation'

export const Route = createFileRoute('/api/collections')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        assertAppSession(request)
        const rows = await db
          .select()
          .from(collections)
          .orderBy(desc(collections.updatedAt))

        return Response.json({
          collections: rows.map((r) => ({
            id: r.id,
            name: r.name,
            memo: r.memo,
            lat: r.lat,
            lng: r.lng,
            createdAt: r.createdAt.toISOString(),
            updatedAt: r.updatedAt.toISOString(),
          })),
        })
      },
      POST: async ({ request }) => {
        assertAppSession(request)
        const body = await request.json().catch(() => null)
        const { name, memo, lat, lng } = parseCollectionCreate(body)

        const existing = await db.select().from(collections)
        const duplicate = findCollectionNear(lat, lng, existing)
        if (duplicate) {
          return Response.json(
            {
              error: '此位置附近已有收藏，請編輯現有項目。',
            },
            { status: 409 },
          )
        }

        const [row] = await db
          .insert(collections)
          .values({ name, memo, lat, lng })
          .returning()

        if (!row) {
          throw new Response('Insert failed', { status: 500 })
        }

        return Response.json({
          collection: {
            id: row.id,
            name: row.name,
            memo: row.memo,
            lat: row.lat,
            lng: row.lng,
            createdAt: row.createdAt.toISOString(),
            updatedAt: row.updatedAt.toISOString(),
          },
        })
      },
    },
  },
})
