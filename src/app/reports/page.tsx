// app/reports/page.tsx

import { getReports } from '@/lib/s3/getReports'

import Link from 'next/link'

const ReportsPage = async () => {
  const reports = await getReports()
  const filteredReports = reports.filter(report => (report.key.endsWith('pdf') && !report.key.includes('scheduled')))

  return (
    <div className="p-10">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-3xl font-bold mb-8">
          Report History
        </h1>

        <div className="flex items-center gap-4">
          <Link
            href="/logout"
            className="text-sm font-medium text-blue-600 hover:text-blue-800 underline"
          >
            Logout
          </Link>
        </div>
      </div>

      <div className="mt-4 mb-2 border-b border-slate-200">
        <nav className="flex gap-6 text-sm font-medium">
          <Link href="/dashboard" className="border-b-2 border-transparent pb-2 text-slate-500">Home</Link>
          <Link href="/insights" className="border-b-2 border-transparent pb-2 text-slate-500 hover:text-slate-700">Insights</Link>
          <Link href="/infrastructure" className="border-b-2 border-transparent pb-2 text-slate-500 hover:text-slate-700">Infrastructure</Link>
          <Link href="/reports" className="border-b-2 border-blue-600 pb-2 text-blue-600">Reports</Link>
        </nav>
      </div>

      <table className="w-full border">
        <thead>
          <tr className="border-b">
            <th className="p-3 text-left">
              Month
            </th>

            <th className="p-3 text-left">
              Generated
            </th>

            <th className="p-3">
              Actions
            </th>
          </tr>
        </thead>

        <tbody>
          {filteredReports.map(report => (
            <tr
              key={report.month}
              className="border-b"
            >
              <td className="p-3">
                {report.month}
              </td>

              <td className="p-3">
                {new Date(
                  report.generatedAt
                ).toLocaleString()}
              </td>

              <td className="p-3 flex gap-4">
                <a
                  href={`/reports/${report.month}`}
                  className="text-blue-600"
                >
                  View
                </a>

                <a
                  href={`/api/reports/${report.month}/pdf`}
                  className="text-green-600"
                >
                  PDF
                </a>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default ReportsPage