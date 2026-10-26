import 'server-only'
import jwt from 'jsonwebtoken'
import { AsyncLocalStorage } from 'node:async_hooks'
import { headers } from 'next/headers'
import { PW_SALT, USERS, USER_IDS } from '@/lib/config'

export const SESSION_COOKIE = 'costinsights_session'
type Session = { token: string; email: string; userId: string }
const context = new AsyncLocalStorage<Session>()

export function verifyToken(token: string): Session {
  const payload = jwt.verify(token, PW_SALT, { algorithms: ['HS256'] })
  if (typeof payload === 'string' || typeof payload.id !== 'string' ||
      typeof payload.exp !== 'number') throw new Error('Invalid token')
  if (!Object.hasOwn(USERS, payload.id) || !Object.hasOwn(USER_IDS, payload.id)) {
    throw new Error('Unauthorized user')
  }
  return { token, email: payload.id, userId: String(USER_IDS[payload.id]) }
}

export function sessionFromHeaders(values: Headers): Session {
  const authorization = values.get('authorization')
  if (authorization !== null) {
    const match = /^Bearer ([^\s]+)$/i.exec(authorization)
    if (!match) throw new Error('Invalid authorization')
    return verifyToken(match[1])
  }
  const cookie = values.get('cookie')?.split(';').map(v => v.trim())
    .find(v => v.startsWith(SESSION_COOKIE + '='))?.slice(SESSION_COOKIE.length + 1)
  if (!cookie) throw new Error('Authentication required')
  return verifyToken(cookie)
}

export async function requireSession(): Promise<Session> {
  const session = context.getStore()
  return session ? verifyToken(session.token) : sessionFromHeaders(new Headers(await headers()))
}

export function sameOrigin(request: Request, requireEvidence = true): boolean {
  const origin = request.headers.get('origin')
  const site = request.headers.get('sec-fetch-site')
  if (site && !['same-origin', 'none'].includes(site)) return false
  // Use the configured public origin across HTTPS termination. Never derive trust
  // from caller-controlled Host/X-Forwarded-* headers. Production fails closed
  // if the public application URL is missing or misconfigured.
  try {
    const configured = process.env.NEXT_PUBLIC_BASE_URL
    if (!configured && process.env.NODE_ENV === 'production') return false
    const expected = new URL(configured || request.url)
    if (!['https:', 'http:'].includes(expected.protocol) || expected.username || expected.password) return false
    if (process.env.NODE_ENV === 'production' && expected.protocol !== 'https:') return false
    if (origin !== null) return origin === expected.origin
    return !requireEvidence || site === 'same-origin'
  } catch {
    return false
  }
}

// All configured users currently have access to the shared AWS account.
// User-owned conversation data receives additional ownership checks below.
export function withAuth<R extends Request, A extends unknown[]>(
  handler: (request: R, ...args: A) => Promise<Response>,
  options: { userOwned?: boolean; updateConversation?: boolean; stateChanging?: boolean } = {}
) {
  return async (request: R, ...args: A): Promise<Response> => {
    let session: Session
    try { session = sessionFromHeaders(request.headers) } catch {
      return Response.json({ success: false, error: 'Authentication required' }, { status: 401 })
    }
    // Explicit, verified Bearer credentials are not ambient browser cookies.
    // Preserve API/server callers even when browser origin metadata is absent.
    if (!request.headers.has('authorization')) {
      const safeRead = ['GET', 'HEAD', 'OPTIONS'].includes(request.method) && !options.stateChanging
      if (!sameOrigin(request, !safeRead)) return forbidden()
    }
    return context.run(session, async () => {
      const url = new URL(request.url)
      if (options.userOwned) {
        let body: Record<string, unknown> = {}
        if (request.method !== 'GET' && request.method !== 'HEAD') {
          try { body = await request.clone().json() } catch {
            return Response.json({ error: 'Invalid JSON' }, { status: 400 })
          }
        }
        const userId = request.method === 'GET' ? url.searchParams.get('userId') : body?.userId
        if (userId !== session.userId) return forbidden()
        // Check the stored owner before allowing updates by database record ID.
        if (options.updateConversation) {
          const id = decodeURIComponent(url.pathname.split('/').pop()!)
          const target = new URL(process.env.MESSAGE_API_URL + '/db/awsCopilotConversations')
          target.searchParams.set('userId', session.userId)
          target.searchParams.set('limit', '200')
          target.searchParams.set('tspAuthToken', process.env.API_AUTH_TOKEN ?? '')
          const response = await fetch(target, { cache: 'no-store' })
          if (!response.ok) return forbidden()
          const data = await response.json()
          if (!Array.isArray(data.records) || !data.records.some((r: { _id: string; userId: string }) =>
            r._id === id && r.userId === session.userId)) return forbidden()
        }
      }
      const response = await handler(request, ...args)
      response.headers.set('Cache-Control', 'private, no-store')
      return response
    })
  }
}

function forbidden() {
  return Response.json({ success: false, error: 'Forbidden' }, { status: 403 })
}

// Forward the caller's JWT only to this application's API; never to AWS/OpenAI.
export async function internalFetch(input: string, init: RequestInit = {}) {
  const session = await requireSession()
  const base = new URL(process.env.NEXT_PUBLIC_BASE_URL!)
  const target = new URL(input, base)
  if (target.origin !== base.origin || !target.pathname.startsWith('/api/')) {
    throw new Error('Invalid internal API target')
  }
  const values = new Headers(init.headers)
  values.set('Authorization', 'Bearer ' + session.token)
  return fetch(target, { ...init, headers: values, cache: 'no-store', redirect: 'error' })
}
