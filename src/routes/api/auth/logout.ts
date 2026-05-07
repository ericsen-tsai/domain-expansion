import { createFileRoute } from '@tanstack/react-router'

import { buildSessionClearCookie } from '#/server/app-session'

export const Route = createFileRoute('/api/auth/logout')({
  server: {
    handlers: {
      POST: async () => {
        return Response.json(
          { ok: true },
          {
            status: 200,
            headers: {
              'Set-Cookie': buildSessionClearCookie(),
            },
          },
        )
      },
    },
  },
})
