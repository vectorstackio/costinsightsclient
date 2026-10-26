import { withReportAuth } from '@/lib/reports/auth'
// app/api/reports/generate/route.ts

import { getOrCreateReport } from '@/lib/reports'
import { getReportPdf, saveReportPdf } from '@/lib/s3/reports'
import { generatePdf } from '@/lib/reports/pdf'
import { getPreviousMonthYYYYMM } from '@/lib/date'

async function handleGET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const month = searchParams.get('month') ?? getPreviousMonthYYYYMM()
    await getOrCreateReport(month)
    const key = `reports/aws-cost-${month}.pdf`
    let pdf = await getReportPdf(key)
    if (!pdf) {
      const generated = await generatePdf(month)
      pdf = new Uint8Array(generated)
      await saveReportPdf(key, pdf)
    }

    return Response.json({
      message: 'Report generated',
      month,
      key
    })
  } catch (err: unknown) {
    if (err instanceof Error) {
      return Response.json({ success: false, error: err.message }, { status: 401 })
    } else {
      return Response.json({ success: false, error: 'Unknown error' }, { status: 401 })
    }
  }
  
}
export const GET = withReportAuth(handleGET, '/api/reports/generate')
