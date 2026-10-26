import 'server-only'
import { AsyncLocalStorage } from 'node:async_hooks'
import { createHash, timingSafeEqual } from 'node:crypto'
import { headers } from 'next/headers'
import * as configuration from '@/lib/config'
import { requireSession, withAuth } from '@/lib/auth/server'
import { getPreviousMonthYYYYMM } from '@/lib/date'

type ReportAccess = { authorization: string; month: string }
const reportContext = new AsyncLocalStorage<ReportAccess | undefined>()
const validMonth = (month: string) => month.length === 7 && /^\d{4}-(0[1-9]|1[0-2])$/.test(month)
const isReportJob = (authorization: string | null) => /^ReportJob(?:\s|$)/i.test(authorization ?? '')

function verifyReportJob(authorization: string | null): string {
  // Existing ignored configuration files need not define the optional export:
  // user authentication still works while scheduled access remains disabled.
  const expected: unknown = Reflect.get(configuration, 'REPORT_JOB_TOKEN')
  const match = /^ReportJob ([A-Za-z0-9_-]{32,256})$/i.exec(authorization ?? '')
  if (!match || typeof expected !== 'string' || expected.length < 32 || expected.length > 256 ||
      /[^A-Za-z0-9_-]/.test(expected)) throw new Error('Authentication required')
  const digest = (value: string) => createHash('sha256').update(value).digest()
  if (!timingSafeEqual(digest(match[1]), digest(expected))) throw new Error('Authentication required')
  return 'ReportJob ' + match[1]
}

export async function requireReportAccess(month: string): Promise<ReportAccess> {
  const access = reportContext.getStore()
  if (access) {
    if (!validMonth(month) || month !== access.month) throw new Error('Report access denied')
    // Recheck configuration so a rotated/disabled credential is not retained.
    verifyReportJob(access.authorization)
    return access
  }
  const session = await requireSession()
  return { authorization: 'Bearer ' + session.token, month }
}

// Only the two explicitly named report API entry points establish job context.
export function withReportAuth(
  handler: (request: Request) => Promise<Response>,
  path: '/api/reports' | '/api/reports/generate'
) {
  const userHandler = withAuth(handler, { stateChanging: path === '/api/reports/generate' })
  return async (request: Request): Promise<Response> => {
    const authorization = request.headers.get('authorization')
    if (!isReportJob(authorization)) return reportContext.run(undefined, () => userHandler(request))
    let verified: string
    try { verified = verifyReportJob(authorization) } catch {
      return Response.json({ success: false, error: 'Authentication required' }, { status: 401, headers: { 'Cache-Control': 'private, no-store' } })
    }
    const url = new URL(request.url)
    if (request.method !== 'GET' || url.pathname !== path) {
      return Response.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }
    const months = url.searchParams.getAll('month')
    const month = months[0] ?? (path === '/api/reports/generate' ? getPreviousMonthYYYYMM() : '')
    if (months.length > 1 || !validMonth(month) || Array.from(url.searchParams.keys()).some(key => key !== 'month')) {
      return Response.json({ success: false, error: 'Invalid report month or parameters' }, { status: 400 })
    }
    return reportContext.run({ authorization: verified, month }, async () => {
      try {
        const response = await handler(request)
        // Existing user error contracts remain unchanged; machine failures never
        // echo service/Chromium errors, which could contain sensitive headers.
        if (!response.ok) throw new Error('Report request failed')
        response.headers.set('Cache-Control', 'private, no-store')
        return response
      } catch {
        return Response.json({ success: false, error: 'Report generation failed' }, { status: 500, headers: { 'Cache-Control': 'private, no-store' } })
      }
    })
  }
}

// Used only by the existing /reports/[month] Server Component. The report-page
// proxy rejects non-GET requests and non-document variants before rendering.
export async function withReportPageAccess<T>(month: string, operation: () => Promise<T>): Promise<T> {
  const values = await headers()
  const authorization = values.get('authorization')
  if (!isReportJob(authorization)) {
    await requireSession()
    return reportContext.run(undefined, operation)
  }
  try {
    const verified = verifyReportJob(authorization)
    if (!validMonth(month)) throw new Error('Invalid month')
    return await reportContext.run({ authorization: verified, month }, operation)
  } catch {
    // Do not attach the original exception or credentials to Next.js error output.
    throw new Error('Unable to load authenticated report')
  }
}

// Fixed destination: no general-purpose internal fetch support for ReportJob.
export function reportApplicationUrl(authorization: string): URL {
  const base = new URL(process.env.NEXT_PUBLIC_BASE_URL!)
  if (!['http:', 'https:'].includes(base.protocol) || base.username || base.password ||
      (isReportJob(authorization) && base.protocol === 'http:' &&
       !['localhost', '127.0.0.1', '[::1]'].includes(base.hostname))) {
    throw new Error('Invalid application URL')
  }
  return base
}

export async function fetchReportData(month: string): Promise<Response> {
  const access = await requireReportAccess(month)
  const base = reportApplicationUrl(access.authorization)
  const target = new URL('/api/reports', base)
  target.searchParams.set('month', month)
  try {
    return await fetch(target, {
      method: 'GET',
      headers: { Authorization: access.authorization, 'Content-Type': 'application/json' },
      cache: 'no-store',
      redirect: 'error'
    })
  } catch {
    throw new Error('Unable to load report data')
  }
}
