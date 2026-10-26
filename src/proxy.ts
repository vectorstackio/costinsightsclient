import { NextResponse } from 'next/server'

// Server Components do not expose the HTTP method. Keep machine rendering to
// the exact GET document route; do not authenticate or alter ordinary users.
export function proxy(request: Request) {
  if (/^ReportJob(?:\s|$)/i.test(request.headers.get('authorization') ?? '')) {
    const url = new URL(request.url)
    if (request.method !== 'GET' || !/^\/reports\/\d{4}-(0[1-9]|1[0-2])$/.test(url.pathname) ||
        url.search !== '' || request.headers.has('rsc') || request.headers.has('next-router-prefetch')) {
      return Response.json({ success: false, error: 'Forbidden' }, { status: 403, headers: { 'Cache-Control': 'private, no-store' } })
    }
  }
  const response = NextResponse.next()
  if (/^ReportJob(?:\s|$)/i.test(request.headers.get('authorization') ?? '')) {
    response.headers.set('Cache-Control', 'private, no-store')
  }
  return response
}

export const config = { matcher: '/reports/:path*' }
