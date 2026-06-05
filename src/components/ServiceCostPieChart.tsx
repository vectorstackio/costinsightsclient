// components/ServiceCostPieChart.tsx

'use client'

import {
  PieChart,
  Pie,
  Tooltip,
  ResponsiveContainer,
  Cell
} from 'recharts'

type ServiceCost = {
  service: string
  cost: number
}

type Props = {
  data: ServiceCost[]
}

// Optional: nicer colors (AWS-style muted palette)
const COLORS = [
  '#6366f1',
  '#22c55e',
  '#f59e0b',
  '#ef4444',
  '#06b6d4',
  '#a855f7',
  '#84cc16'
]

const ServiceCostPieChart = ({ data }: Props) => {
  return (
    <div className="border rounded p-4">
      <h2 className="font-semibold mb-4">
        Cost Distribution
      </h2>

      <div style={{ width: '100%', height: 350 }}>
        <ResponsiveContainer>
          <PieChart>
            <Pie
              data={data}
              dataKey="cost"
              nameKey="service"
              cx="50%"
              cy="50%"
              outerRadius={120}
              // label={({ name, percent }) =>
              //   `${name.slice(0, 12)}... (${(percent * 100).toFixed(0)}%)`
              // }
              label={({ name, percent }) => {
                const safeName = (name ?? 'Unknown').toString()
                const safePercent = percent ?? 0

                return `${safeName.slice(0, 12)}... (${(safePercent * 100).toFixed(0)}%)`
              }}
            >
              {data.map((_, index) => (
                <Cell
                  key={index}
                  fill={COLORS[index % COLORS.length]}
                />
              ))}
            </Pie>

            <Tooltip
              formatter={(value) =>
                `£${Number(value ?? 0).toFixed(2)}`
              }
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

export default ServiceCostPieChart