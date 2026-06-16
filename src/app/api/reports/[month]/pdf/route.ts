// app/api/reports/[month]/pdf/route.ts

import { generatePdf } from '@/lib/reports/pdf'

export const runtime = 'nodejs'

export async function GET(
  request: Request,
  context: {
    params: Promise<{ month: string }>
  }
) {
  const { month } = await context.params

  const pdf = await generatePdf(month)

  return new Response(pdf, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition':
        `attachment; filename="aws-cost-report-${month}.pdf"`
    }
  })
}

// import { generatePdf } from '@/lib/reports/pdf'

// export const runtime = 'nodejs'

// export async function GET(
//   request: Request,
//   context: {
//     params: Promise<{ month: string }>
//   }
// ) {
//   const { month } = await context.params

//   const pdf = await generatePdf(month)

//   return new Response(pdf, {
//     headers: {
//       'Content-Type': 'application/pdf',
//       'Content-Disposition':
//         `attachment; filename="aws-cost-report-${month}.pdf"`
//     }
//   })
// }