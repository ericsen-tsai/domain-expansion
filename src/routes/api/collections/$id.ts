import { createFileRoute } from '@tanstack/react-router'
import { eq } from 'drizzle-orm'

import { db } from '#/db/client'
import { collections } from '#/db/schema'
import { assertAppSession } from '#/server/app-session'
import {
  parseCollectionId,
  parseCollectionPatch,
} from '#/server/validation'

export const Route = createFileRoute('/api/collections/$id')({
  server: {
    handlers: {
      PATCH: async ({ params, request }) => {
        assertAppSession(request)
        const id = parseCollectionId(params.id)
        const body = await request.json().catch(() => null)
        const patch = parseCollectionPatch(body)

        const update: {
          name?: string
          memo?: string
          updatedAt: Date
        } = { updatedAt: new Date() }
        if (patch.name !== undefined) update.name = patch.name
        if (patch.memo !== undefined) update.memo = patch.memo

        const [row] = await db
          .update(collections)
          .set(update)
          .where(eq(collections.id, id))
          .returning()

        if (!row) {
          return Response.json({ error: 'Not found' }, { status: 404 })
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
      DELETE: async ({ params, request }) => {
        assertAppSession(request)
        const id = parseCollectionId(params.id)

        const [deleted] = await db
          .delete(collections)
          .where(eq(collections.id, id))
          .returning()

        if (!deleted) {
          return Response.json({ error: 'Not found' }, { status: 404 })
        }

        return new Response(null, { status: 204 })
      },
    },
  },
})
