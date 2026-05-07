import { createFileRoute } from '@tanstack/react-router'
import { asc } from 'drizzle-orm'

import { db } from '#/db/client'
import { domainVertices } from '#/db/schema'
import { assertAppSession } from '#/server/app-session'

export const Route = createFileRoute('/api/domain')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        assertAppSession(request)
        const rows = await db
          .select()
          .from(domainVertices)
          .orderBy(asc(domainVertices.idx))

        return Response.json({
          vertices: rows.map((r) => ({ idx: r.idx, lat: r.lat, lng: r.lng })),
        })
      },
    },
  },
})

