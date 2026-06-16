// app/api/reports/route.ts

import { mapSummaryToInsights } from '@/lib/insights'
import { buildReport } from '@/lib/reports'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)

  const month = searchParams.get('month') // "2026-05" or null

  const url = new URL(`${process.env.COST_API_URL}/summary`)

  if (month) {
    url.searchParams.set('month', month)
  }

  const res = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json'
    }
  })

  if (!res.ok) {
    throw new Error(`Failed to fetch summary: ${res.statusText}`)
  }

  const summary = await res.json()

  const insights = mapSummaryToInsights(summary)

  const report = await buildReport(insights)

  return Response.json(report)
}