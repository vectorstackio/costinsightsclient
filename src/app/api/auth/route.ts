import { NextResponse } from 'next/server'
import { sameOrigin, sessionFromHeaders, SESSION_COOKIE, verifyToken } from '@/lib/auth/server'

function allowSessionMutation(req: Request): boolean {
  if (!req.headers.has('authorization')) return sameOrigin(req)
  try {
    sessionFromHeaders(req.headers)
    return true
  } catch {
    return false
  }
}

// Establish a browser session using the JWT returned by the unchanged login route.
export async function POST(req: Request) {
  if (!allowSessionMutation(req)) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  try {
    const { token } = await req.json()
    verifyToken(token)
    const response = NextResponse.json({ success: true }, { headers: { 'Cache-Control': 'no-store' } })
    response.cookies.set(SESSION_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production' || new URL(req.url).protocol === 'https:',
      sameSite: 'strict',
      path: '/',
    })
    return response
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid or expired token' }, { status: 401 })
  }
}

export async function DELETE(req: Request) {
  if (!allowSessionMutation(req)) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  const response = NextResponse.json({ success: true })
  response.cookies.set(SESSION_COOKIE, '', { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict', path: '/', maxAge: 0 })
  return response
}
