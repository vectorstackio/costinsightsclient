// components/ServiceCostPieChart.tsx

'use client'

import {
  PieChart,
  Pie,
  Tooltip,
  ResponsiveContainer,
  Cell
} from 'recharts'

import { /*useEffect,*/ useState } from 'react'

/**
 * -----------------------
 * Types
 * -----------------------
 */

type ServiceCost = {
  service: string
  cost: number
}

type DrilldownItem = {
  key: string
  cost: number
}

type CostFilter = {
  key: string
  value: string
}

type Props = {
  data: ServiceCost[]
}

const COLORS = [
  '#6366f1',
  '#22c55e',
  '#f59e0b',
  '#ef4444',
  '#06b6d4',
  '#a855f7',
  '#84cc16'
]

/**
 * -----------------------
 * Component
 * -----------------------
 */

const ServiceCostPieChart = ({ data }: Props) => {
  const [selectedService, setSelectedService] = useState<string | null>(null)

  const [drilldown, setDrilldown] = useState<DrilldownItem[] | null>(null)
  const [loading, setLoading] = useState(false)

  /**
   * -----------------------
   * Load drilldown (NEW ENGINE)
   * -----------------------
   */
  async function loadDrilldown(service: string) {
    setLoading(true)

    try {
      const filters: CostFilter[] = [
        {
          key: 'SERVICE',
          value: service
        }
      ]

      const res = await fetch('/api/costs/drilldown', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          filters,
          groupBy: 'INSTANCE_TYPE'
        })
      })

      const json = await res.json()

      setDrilldown(json.items)
    } finally {
      setLoading(false)
    }
  }

  /**
   * -----------------------
   * Handle selection
   * -----------------------
   */
  function handleSelect(service: string) {
    setSelectedService(service)
    loadDrilldown(service)
  }

  /**
   * -----------------------
   * UI
   * -----------------------
   */

  return (
    <div className="border rounded p-4">
      <h2 className="font-semibold mb-4">
        Cost Distribution
      </h2>

      {/* ---------------- Pie chart ---------------- */}
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
              onClick={(_, index) => {
                const item = data[index]
                if (item) handleSelect(item.service)
              }}
              label={({ name, percent }) => {
                const safeName =
                  typeof name === 'string' ? name : 'Unknown'

                const safePercent =
                  typeof percent === 'number' ? percent : 0

                return `${safeName.slice(0, 12)}... (${(
                  safePercent * 100
                ).toFixed(0)}%)`
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

      {/* ---------------- Drilldown ---------------- */}
      {selectedService && (
        <div className="mt-6 border-t pt-4">
          <h3 className="font-semibold mb-2">
            {selectedService} breakdown
          </h3>

          {loading ? (
            <div className="text-sm text-gray-500">
              Loading...
            </div>
          ) : !drilldown ? (
            <div className="text-sm text-gray-500">
              No data
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b">
                  <th className="py-2">Item</th>
                  <th className="py-2">Cost</th>
                </tr>
              </thead>

              <tbody>
                {drilldown.map((item) => (
                  <tr key={item.key} className="border-b">
                    <td className="py-2">{item.key}</td>
                    <td className="py-2">
                      £{item.cost.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  )
}

export default ServiceCostPieChart