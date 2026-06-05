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

type ServiceCost = {
  service: string
  cost: number
}

type Props = {
  data: ServiceCost[]
}

const ServiceCostChart = ({ data }: Props) => {
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
            formatter={(value) => [
              `£${Number(value ?? 0).toFixed(2)}`,
              'Cost'
            ]}
          />

          <Bar dataKey="cost" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

export default ServiceCostChart