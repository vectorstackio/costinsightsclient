// app/api/reports/[month]/pdf/route.ts

import { generatePdf } from '@/lib/reports/pdf'
import {
  getReportPdf,
  saveReportPdf
} from '@/lib/s3/reports'

import { getOrCreateReport } from '@/lib/reports'

export const runtime = 'nodejs'

export async function GET(
  request: Request,
  context: { params: Promise<{ month: string }> }
) {
  const { month } = await context.params

  const key =
    `reports/aws-cost-${month}.pdf`

  /**
   * -----------------------
   * Try existing PDF first
   * -----------------------
   */
  let pdf =
    await getReportPdf(key)

  /**
   * -----------------------
   * Create PDF if missing
   * -----------------------
   */
  if (!pdf) {

    /**
     * Ensure the JSON report exists
     *
     * This will:
     * - read from S3 if available
     * - otherwise build and save it
     */
    await getOrCreateReport(month)

    const generatedPdf =
      await generatePdf(month)

    pdf =
      new Uint8Array(
        generatedPdf
      )

    await saveReportPdf(
      key,
      pdf
    )
  }

  /**
   * -----------------------
   * Return PDF
   * -----------------------
   */
  return new Response(
    Uint8Array.from(pdf),
    {
      headers: {
        'Content-Type':
          'application/pdf',

        'Content-Disposition':
          `attachment; filename="aws-cost-report-${month}.pdf"`
      }
    }
  )
  // return new Response(pdf, {
  //   headers: {
  //     'Content-Type':
  //       'application/pdf',

  //     'Content-Disposition':
  //       `attachment; filename="aws-cost-report-${month}.pdf"`
  //   }
  // })
}

// import { generatePdf } from '@/lib/reports/pdf'
// import { uploadPdfToS3 } from '@/lib/s3/uploadPdf'

// export const runtime = 'nodejs'

// export async function GET(
//   request: Request,
//   context: { params: Promise<{ month: string }> }
// ) {
//   const { month } = await context.params

//   const pdf = await generatePdf(month)

//   const key = `reports/aws-cost-${month}.pdf`

//   await uploadPdfToS3(new Uint8Array(pdf), key)

//   /**
//    * Return PDF to browser
//    */
//   return new Response(pdf, {
//     headers: {
//       'Content-Type': 'application/pdf',
//       'Content-Disposition':
//       `attachment; filename="aws-cost-report-${month}.pdf"`
//     }
//   })
// }