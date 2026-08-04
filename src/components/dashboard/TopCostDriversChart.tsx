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

import { formatCurrency } from '@/lib/reports'

import type { CostIncreaseDriver, Currency } from '@/types'

type Props = {
  data: CostIncreaseDriver[]
  onSelectService?: (service: string | null) => void
  currency: Currency
}

const TopCostDriversChart = ({ data, onSelectService, currency }: Props) => {
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
            <Tooltip
              formatter={(v) =>
                formatCurrency(
                  Number(v),
                  currency
                )
              }
            />
            <Bar
              dataKey="increase"
              fill="#ef4444"
              cursor="pointer"
              onClick={(data) => {
                const service = data.payload?.service ?? null
                onSelectService?.(service)
              }}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

export default TopCostDriversChart