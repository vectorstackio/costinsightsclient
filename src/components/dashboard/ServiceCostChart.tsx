// components/ServiceCostChart.tsx

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

import type { Currency } from '@/types'

type ServiceCost = {
  service: string
  cost: number
}

type Props = {
  data: ServiceCost[]
  onSelectService?: (service: string | null) => void
  currency: Currency
}

const ServiceCostChart = ({ data, onSelectService, currency }: Props) => {
  return (
    <div className="border rounded p-4">
      <h2 className="font-semibold mb-4">
        Cost by Service
      </h2>

      <ResponsiveContainer width="100%" height={400}>
        <BarChart data={data}>
          <XAxis
            dataKey="service"
            tickFormatter={(value: string) =>
              value
                .replace('Amazon ', '')
                .replace('AWS ', '')
                .replace(' - Compute', '')
            }
            angle={-20}
            textAnchor="end"
            height={100}
          />

          <YAxis />

          <Tooltip
            formatter={(v) =>
              formatCurrency(
                Number(v ?? 0),
                currency
              )
            }
          />

          <Bar
            dataKey="cost"
            cursor="pointer"
            onClick={(data) => {
              const service = data.payload?.service ?? null
              onSelectService?.(service)
            }}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

export default ServiceCostChart