export function assertDomainSecret(request: Request): void {
  const expected = process.env.DOMAIN_SECRET

  if (!expected) {
    throw new Error('Missing DOMAIN_SECRET')
  }

  const provided =
    request.headers.get('x-domain-secret') ??
    request.headers.get('X-Domain-Secret') ??
    (() => {
      const auth = request.headers.get('authorization')
      if (!auth) return null
      const match = auth.match(/^Bearer\s+(.+)$/i)
      return match?.[1] ?? null
    })()

  if (!provided || provided !== expected) {
    throw new Response('Unauthorized', { status: 401 })
  }
}

