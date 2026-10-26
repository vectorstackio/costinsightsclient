import { withAuth } from '@/lib/auth/server'
// app/api/reports/route.ts

import { getOrCreateReport } from '@/lib/reports'

async function handleGET(
  request: Request
) {
  const { searchParams } =
    new URL(request.url)

  const month =
    searchParams.get('month')

  if (!month) {
    return Response.json(
      {
        error: 'month is required'
      },
      {
        status: 400
      }
    )
  }

  const report =
    await getOrCreateReport(month)

  return Response.json(report)
}

// import { mapSummaryToInsights } from '@/lib/insights'
// import { buildReport } from '@/lib/reports'
// import { getReportJson, saveReportJson } from '@/lib/s3/reports'

// export async function GET(request: Request) {
//   const { searchParams } = new URL(request.url)

//   const month = searchParams.get('month')

//   // 1. Try S3 first (cache hit)
//   if (month) {
//     const cached = await getReportJson(month)
//     if (cached) {
//       return Response.json(cached)
//     }
//   }

//   // 2. Build fresh report (cache miss)
//   const url = new URL(`${process.env.COST_API_URL}/summary`)

//   if (month) {
//     url.searchParams.set('month', month)
//   }

//   const res = await fetch(url.toString(), {
//     method: 'GET',
//     headers: {
//       'Content-Type': 'application/json'
//     }
//   })

//   if (!res.ok) {
//     throw new Error(`Failed to fetch summary: ${res.statusText}`)
//   }

//   const summary = await res.json()

//   const insights = mapSummaryToInsights(summary)

//   const report = await buildReport(insights, month ?? new Date().toISOString().slice(0, 7))

//   // 3. Store in S3
//   if (month) {
//     await saveReportJson(month, report)
//   }

//   return Response.json(report)
// }
export const GET = withAuth(handleGET)
