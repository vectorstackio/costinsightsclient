import { withAuth } from '@/lib/auth/server'
// app/api/reports/history/route.ts

import { getReports } from '@/lib/s3/getReports'

export const runtime = 'nodejs'

async function handleGET(_request: Request) {
  const reports = await getReports()

  return Response.json(reports)
}
export const GET = withAuth(handleGET)
