import { createHash, createHmac, timingSafeEqual } from 'node:crypto'

export const APP_SESSION_COOKIE = 'app_session'

const SESSION_MS = 7 * 24 * 60 * 60 * 1000

function sessionKey(): Buffer {
  const passphrase = process.env.APP_PASSPHRASE
  if (!passphrase) {
    throw new Error('Missing APP_PASSPHRASE')
  }
  return createHash('sha256').update(`app_session_v1:${passphrase}`, 'utf8').digest()
}

function b64url(buf: Buffer): string {
  return buf
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

function b64urlDecode(s: string): Buffer {
  const pad = 4 - (s.length % 4 || 4)
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat(pad % 4)
  return Buffer.from(b64, 'base64')
}

export function timingSafePassphraseEqual(
  provided: string,
  expected: string,
): boolean {
  const a = createHash('sha256').update(provided, 'utf8').digest()
  const b = createHash('sha256').update(expected, 'utf8').digest()
  return timingSafeEqual(a, b)
}

export function issueSessionToken(): string {
  const exp = Date.now() + SESSION_MS
  const payload = Buffer.from(JSON.stringify({ exp }), 'utf8')
  const sig = createHmac('sha256', sessionKey()).update(payload).digest()
  return `${b64url(payload)}.${b64url(sig)}`
}

export function verifySessionToken(token: string | undefined): boolean {
  if (!token) return false
  const dot = token.indexOf('.')
  if (dot <= 0) return false
  const payloadB64 = token.slice(0, dot)
  const sigB64 = token.slice(dot + 1)
  let payload: Buffer
  let sig: Buffer
  try {
    payload = b64urlDecode(payloadB64)
    sig = b64urlDecode(sigB64)
  } catch {
    return false
  }
  const expected = createHmac('sha256', sessionKey()).update(payload).digest()
  if (sig.length !== expected.length || !timingSafeEqual(sig, expected)) {
    return false
  }
  let parsed: { exp?: unknown }
  try {
    parsed = JSON.parse(payload.toString('utf8')) as { exp?: unknown }
  } catch {
    return false
  }
  if (typeof parsed.exp !== 'number' || !Number.isFinite(parsed.exp)) {
    return false
  }
  if (parsed.exp <= Date.now()) return false
  return true
}

export function getAppSessionCookie(request: Request): string | undefined {
  const raw = request.headers.get('cookie')
  if (!raw) return undefined
  for (const part of raw.split(';')) {
    const [name, ...rest] = part.trim().split('=')
    if (name === APP_SESSION_COOKIE) {
      return decodeURIComponent(rest.join('='))
    }
  }
  return undefined
}

export function assertAppSession(request: Request): void {
  const token = getAppSessionCookie(request)
  if (!verifySessionToken(token)) {
    throw new Response('Unauthorized', { status: 401 })
  }
}

export function buildSessionSetCookie(token: string): string {
  const secure = process.env.NODE_ENV === 'production'
  const parts = [
    `${APP_SESSION_COOKIE}=${encodeURIComponent(token)}`,
    'HttpOnly',
    'Path=/',
    'SameSite=Lax',
    `Max-Age=${Math.floor(SESSION_MS / 1000)}`,
  ]
  if (secure) parts.push('Secure')
  return parts.join('; ')
}

export function buildSessionClearCookie(): string {
  const secure = process.env.NODE_ENV === 'production'
  const parts = [
    `${APP_SESSION_COOKIE}=`,
    'HttpOnly',
    'Path=/',
    'SameSite=Lax',
    'Max-Age=0',
  ]
  if (secure) parts.push('Secure')
  return parts.join('; ')
}
