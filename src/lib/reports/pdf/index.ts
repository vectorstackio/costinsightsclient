// lib/reports/pdf/index.ts

export const generatePdf = async (month: string): Promise<ArrayBuffer> => {
  const puppeteer = await import('puppeteer')

  const browser = await puppeteer.default.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  })

  try {
    const page = await browser.newPage()

    await page.goto(
      `${process.env.NEXT_PUBLIC_BASE_URL}/reports/${month}`,
      { waitUntil: 'networkidle0' }
    )

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