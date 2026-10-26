import 'server-only'
import { reportApplicationUrl, requireReportAccess } from '@/lib/reports/auth'

// lib/reports/pdf/index.ts

export const generatePdf = async (month: string): Promise<ArrayBuffer> => {
  const access = await requireReportAccess(month)
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new Error('Invalid report month')
  const base = reportApplicationUrl(access.authorization)
  const target = new URL(`/reports/${month}`, base)
  const puppeteer = await import('puppeteer')

  const browser = await puppeteer.default.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  })

  try {
    const page = await browser.newPage()

    // Only the expected main document needs the JWT. Static/external assets
    // receive no credentials, including credentials inherited through redirects.
    let requestFailed = false
    await page.setRequestInterception(true)
    page.on('request', request => {
      const values = Object.fromEntries(Object.entries(request.headers()).filter(
        ([name]) => !['authorization', 'cookie', 'proxy-authorization'].includes(name.toLowerCase())
      ))
      const mainDocument = request.isNavigationRequest() && request.frame() === page.mainFrame()
      if (mainDocument && (request.url() !== target.href || request.redirectChain().length > 0)) {
        requestFailed = true
        void request.abort('blockedbyclient').catch(() => { requestFailed = true })
        return
      }
      if (mainDocument) values.authorization = access.authorization
      void request.continue({ headers: values }).catch(() => { requestFailed = true })
    })

    const response = await page.goto(
      target.href,
      { waitUntil: 'networkidle0', timeout: 30_000 }
    )

    if (requestFailed || !response?.ok() || response.url() !== target.href ||
        page.url() !== target.href || response.request().redirectChain().length > 0 ||
        !/^text\/html(?:;|$)/i.test(response.headers()['content-type'] ?? '')) {
      throw new Error('Unable to load authenticated report')
    }
    const renderedMonth = await page.$eval('[data-cost-report-month]', element =>
      element.getAttribute('data-cost-report-month'))
    if (requestFailed || page.url() !== target.href || renderedMonth !== month) throw new Error('Unexpected report page')

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
