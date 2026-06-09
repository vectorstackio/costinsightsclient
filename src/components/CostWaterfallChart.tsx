// components/CostWaterfallChart.tsx

'use client'

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine
} from 'recharts'

import { ServiceComparison } from '@/app/dashboard/page'

type Props = {
  data: ServiceComparison[]
}

const CostWaterfallChart = ({ data }: Props) => {
  const chartData = data
    .filter(d => d.change !== 0)
    .map(d => ({
      service: d.service,
      change: d.change
    }))
    .sort((a, b) => b.change - a.change)

  return (
    <div className="border rounded p-4 bg-white">
      <h2 className="font-semibold mb-3">MoM Cost Waterfall</h2>

      <div style={{ width: '100%', height: 300 }}>
        <ResponsiveContainer>
          <BarChart data={chartData}>
            <XAxis dataKey="service" />
            <YAxis />
            <Tooltip formatter={(v) => `£${Number(v).toFixed(2)}`} />

            <ReferenceLine y={0} stroke="#999" />

            <Bar
              dataKey="change"
              fill="#f59e0b"
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

export default CostWaterfallChart