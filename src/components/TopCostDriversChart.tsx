// components/TopCostDriversChart.tsx

'use client'

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer
} from 'recharts'

import { CostIncreaseDriver } from '@/hooks/useCostExplorerController'

type Props = {
  data: CostIncreaseDriver[]
}

const TopCostDriversChart = ({ data }: Props) => {
  const chartData = data.map(d => ({
    service: d.service,
    increase: d.increase
  }))

  return (
    <div className="border rounded p-4 bg-white">
      <h2 className="font-semibold mb-3">Top Cost Increase Drivers</h2>

      <div style={{ width: '100%', height: 300 }}>
        <ResponsiveContainer>
          <BarChart data={chartData}>
            <XAxis dataKey="service" />
            <YAxis />
            <Tooltip formatter={(v) => `£${Number(v).toFixed(2)}`} />
            <Bar dataKey="increase" fill="#ef4444" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

export default TopCostDriversChart