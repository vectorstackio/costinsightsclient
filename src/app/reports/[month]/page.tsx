import { withReportPageAccess } from '@/lib/reports/auth'
// app/reports/\[month\]/page.tsx

import { notFound } from 'next/navigation'
import Image from 'next/image'

import type { CostReport } from '@/types'
import { getReportByMonth, formatCurrency } from '@/lib/reports'

/**
 * -----------------------
 * Metric Card
 * -----------------------
 */
const MetricCard = ({
  label,
  value,
  highlight = false
}: {
  label: string
  value: string
  highlight?: boolean
}) => {
  return (
    <div className="border rounded p-4">
      <div className="text-sm text-gray-500">{label}</div>
      <div className={`text-2xl font-bold ${highlight ? 'text-blue-600' : ''}`}>
        {value}
      </div>
    </div>
  )
}

type Props = {
  params: Promise<{
    month: string
  }>
}

const ReportPage = async ({ params }: Props) => {
  const { month } = await params

  /**
   * -----------------------
   * Fetch report
   * -----------------------
   */
  const report: CostReport | null = await withReportPageAccess(month, () => getReportByMonth(month))

  if (!report) {
    notFound()
  }

  return (
    <>
      <div data-cost-report-month={report.period.month} className="bg-white min-h-screen p-10 text-gray-900 print:p-6 print:bg-white">
        {/* -----------------------
            HEADER
        ----------------------- */}
        <header className="mb-10 border-b pb-6 flex items-start justify-between">
          {/* LEFT SIDE */}
          <div>
            <h1 className="text-3xl font-bold">
              The Brilliant Club AWS Cost Report
            </h1>

            <div className="text-sm text-gray-500 mt-2">
              Period: {report.period.month} · Generated:{' '}
              {new Date(report.period.generatedAt).toLocaleString()}
            </div>
          </div>

          {/* RIGHT SIDE */}
          <div className="flex items-center">
            <Image
              src="/images/HubTBCLogo.png"
              alt="The Brilliant Club"
              width={500}
              height={200}
              className="h-10 w-auto object-contain"
            />
          </div>
        </header>

        {/* -----------------------
            KEY METRICS
        ----------------------- */}
        <section className="grid grid-cols-3 gap-6 mb-10 break-inside-avoid">
          <MetricCard
            label="Current Cost"
            value={formatCurrency(
              report.metrics.currentCost,
              report.metadata.currency
            )}
          />
          <MetricCard
            label="Previous Cost"
            value={formatCurrency(
              report.metrics.previousCost,
              report.metadata.currency
            )}
          />
          <MetricCard
            label="MoM Change"
            value={report.metrics.monthOverMonthChangePercent + '%'}
            highlight
          />
        </section>

        {/* -----------------------
            NARRATIVE
        ----------------------- */}
        <section className="mb-10 break-inside-avoid">
          <h2 className="text-xl font-semibold mb-3">
            Executive Summary
          </h2>

          <p className="text-gray-700 whitespace-pre-line leading-relaxed">
            {report.narratives.executiveSummary}
          </p>
        </section>

        {/* -----------------------
            KEY FINDINGS
        ----------------------- */}
        <section className="mb-10 break-inside-avoid">
          <h2 className="text-xl font-semibold mb-3">
            Key Findings
          </h2>

          <ul className="space-y-2">
            {report.findings.map((f, i) => (
              <li key={i} className="border rounded p-3">
                <div className="font-medium">{f.title}</div>
                <div className="text-sm text-gray-600">
                  {f.description}
                </div>
              </li>
            ))}
          </ul>
        </section>

        {/* -----------------------
            DRIVERS
        ----------------------- */}
        <section className="mb-10 break-inside-avoid">
          <h2 className="text-xl font-semibold mb-3">
            Cost Drivers
          </h2>

          <div className="space-y-2">
            {report.drivers.map((d) => (
              <div
                key={d.service}
                className="flex justify-between border-b py-2"
              >
                <span>{d.service}</span>
                <span className="font-medium">
                  {formatCurrency(
                    d.increase,
                    report.metadata.currency
                  )}
                </span>
              </div>
            ))}
          </div>
        </section>

        <div className="print:pt-10" />

        {/* -----------------------
            ANOMALIES
        ----------------------- */}
        <section className="mb-10 break-inside-avoid">
          <h2 className="text-xl font-semibold mb-3">
            Anomalies
          </h2>

          {report.anomalies.length === 0 ? (
            <p className="text-gray-500">No anomalies detected</p>
          ) : (
            <div className="space-y-2">
              {report.anomalies.map((a) => (
                <div
                  key={a.service}
                  className="border p-3 rounded"
                >
                  <div className="font-medium">
                    {a.service}
                  </div>
                  <div className="text-sm text-gray-600">
                    Spike: {formatCurrency(
                      a.spikeAmount,
                      report.metadata.currency
                    )}{a.spikePercent !== undefined && <> ({a.spikePercent}%)</>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* -----------------------
            SAVINGS
        ----------------------- */}
        <section className="mb-10 break-inside-avoid">
          <h2 className="text-xl font-semibold mb-3">
            Savings Opportunities
          </h2>

          <div className="text-lg font-bold text-green-600">
            {formatCurrency(
              report.savings.totalPotential,
              report.metadata.currency
            )}
          </div>

          <p className="text-sm text-gray-600">
            {report.savings.recommendationCount} recommendations
          </p>
        </section>

        <nav className="print:hidden">
          <div className="w-full flex justify-end">
            <a href={`/api/reports/${month}/pdf`} className="inline-flex px-4 py-2 bg-blue-600 text-white rounded">Download PDF</a>
          </div>
        </nav>
      </div>
    </>
  )
}

export default ReportPage
