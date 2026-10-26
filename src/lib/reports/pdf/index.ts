import 'server-only'
import { requireSession } from '@/lib/auth/server'

// lib/reports/pdf/index.ts

export const generatePdf = async (month: string): Promise<ArrayBuffer> => {
  const session = await requireSession()
  const puppeteer = await import('puppeteer')

  const browser = await puppeteer.default.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  })

  try {
    const page = await browser.newPage()

    // Scope the token to same-origin requests, including the server-rendered report.
    const base = new URL(process.env.NEXT_PUBLIC_BASE_URL!)
    await page.setRequestInterception(true)
    page.on('request', request => {
      const values = { ...request.headers() }
      delete values.authorization
      if (new URL(request.url()).origin === base.origin) values.authorization = 'Bearer ' + session.token
      void request.continue({ headers: values })
    })

    const response = await page.goto(
      `${process.env.NEXT_PUBLIC_BASE_URL}/reports/${month}`,
      { waitUntil: 'networkidle0' }
    )

    if (!response?.ok()) throw new Error('Unable to load authenticated report')

    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true
    })

    // 🔥 NORMALISE TYPE SAFELY
    return new Uint8Array(pdf).buffer
  } finally {
    await browser.close()
  }
}