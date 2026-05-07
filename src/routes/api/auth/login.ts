import { createFileRoute } from '@tanstack/react-router'

import {
  buildSessionSetCookie,
  issueSessionToken,
  timingSafePassphraseEqual,
} from '#/server/app-session'

export const Route = createFileRoute('/api/auth/login')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const expected = process.env.APP_PASSPHRASE
        if (!expected) {
          return Response.json(
            { error: 'APP_PASSPHRASE is not configured' },
            { status: 503 },
          )
        }

        const body = (await request.json().catch(() => null)) as unknown
        const passphrase =
          body &&
          typeof body === 'object' &&
          typeof (body as { passphrase?: unknown }).passphrase === 'string'
            ? (body as { passphrase: string }).passphrase
            : ''

        if (!timingSafePassphraseEqual(passphrase, expected)) {
          return Response.json({ error: 'Invalid passphrase' }, { status: 401 })
        }

        const token = issueSessionToken()
        return Response.json(
          { ok: true },
          {
            status: 200,
            headers: {
              'Set-Cookie': buildSessionSetCookie(token),
            },
          },
        )
      },
    },
  },
})
