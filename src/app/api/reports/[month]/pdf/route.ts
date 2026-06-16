// app/api/reports/[month]/pdf/route.ts

import { generatePdf } from '@/lib/reports/pdf'
import { uploadPdfToS3 } from '@/lib/s3/uploadPdf'

export const runtime = 'nodejs'

export async function GET(
  request: Request,
  context: { params: Promise<{ month: string }> }
) {
  const { month } = await context.params

  const pdf = await generatePdf(month)

  const key = `reports/aws-cost-${month}.pdf`

  await uploadPdfToS3(new Uint8Array(pdf), key)

  //const url = await uploadPdfToS3(new Uint8Array(pdf), key)

  /**
   * Return PDF to browser
   */
  return new Response(pdf, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition':
      `attachment; filename="aws-cost-report-${month}.pdf"`
    }
  })

  // return Response.json({
  //   month,
  //   url
  // })
}