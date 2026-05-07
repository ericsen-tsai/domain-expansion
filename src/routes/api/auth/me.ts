import { createFileRoute } from '@tanstack/react-router'

import {
  getAppSessionCookie,
  verifySessionToken,
} from '#/server/app-session'

export const Route = createFileRoute('/api/auth/me')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const token = getAppSessionCookie(request)
        const authenticated = verifySessionToken(token)
        return Response.json({ authenticated })
      },
    },
  },
})
