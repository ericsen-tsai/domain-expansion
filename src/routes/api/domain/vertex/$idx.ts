import { createFileRoute } from '@tanstack/react-router'
import { asc, eq } from 'drizzle-orm'

import { db } from '#/db/client'
import { domainVertices } from '#/db/schema'
import { assertDomainSecret } from '#/server/auth'
import { parseLatLng, parseVertexIndex } from '#/server/validation'

export const Route = createFileRoute('/api/domain/vertex/$idx')({
  server: {
    handlers: {
      PUT: async ({ params, request }) => {
        assertDomainSecret(request)

        const idx = parseVertexIndex(params.idx)
        const body = await request.json().catch(() => null)
        const { lat, lng } = parseLatLng(body)

        await db
          .update(domainVertices)
          .set({ lat, lng, updatedAt: new Date() })
          .where(eq(domainVertices.idx, idx))

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

