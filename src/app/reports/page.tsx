// app/reports/page.tsx

import { getReports } from '@/lib/s3/getReports'

const ReportsPage = async () => {
  const reports = await getReports()

  return (
    <div className="p-10">
      <h1 className="text-3xl font-bold mb-8">
        Report History
      </h1>

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
          {reports.map(report => (
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
                  href={report.pdfUrl}
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