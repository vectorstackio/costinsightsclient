// app/api/reports/history/route.ts

import { getReports } from '@/lib/s3/getReports'

export const runtime = 'nodejs'

export async function GET() {
  const reports = await getReports()

  return Response.json(reports)
}