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

import { formatCurrency } from '@/lib/reports'

import type { ServiceComparison, Currency } from '@/types'

type Props = {
  data: ServiceComparison[]
  onSelectService?: (service: string | null) => void
  currency: Currency
}

const CostWaterfallChart = ({ data, onSelectService, currency }: Props) => {
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
            <Tooltip
              formatter={(v) =>
                formatCurrency(
                  Number(v),
                  currency
                )
              }
            />

            <ReferenceLine y={0} stroke="#999" />

            <Bar
              dataKey="change"
              fill="#f59e0b"
              cursor="pointer"
              onClick={(data) => {
                const service = data?.payload?.service ?? null
                onSelectService?.(service)
              }}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

export default CostWaterfallChart