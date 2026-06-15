// app/api/reports/route.ts

import { mapSummaryToInsights } from '@/lib/insights'
import { buildReport } from '@/lib/reports'


export async function GET() {
  const res = await fetch(`${process.env.COST_API_URL}/summary`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json'
    }
  })
  const summary = await res.json()
  const insights = mapSummaryToInsights(summary)

  const report = await buildReport(insights)

  return Response.json(report)
}