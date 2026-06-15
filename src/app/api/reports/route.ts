// app/api/reports/route.ts

//import { getSummaryFromAWS } from '@/services/awsService'
import { mapSummaryToInsights } from '@/lib/insights'
import { generateFullReport } from '@/lib/reports'


export async function GET() {
  const res = await fetch(`${process.env.COST_API_URL}/summary`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json'
    }
  })
  const summary = await res.json()
  const insights = mapSummaryToInsights(summary)

  const report = await generateFullReport(insights)

  return Response.json(report)
}