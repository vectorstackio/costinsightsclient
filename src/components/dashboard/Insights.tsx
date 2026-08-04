// components/Insights.tsx

import { formatCurrency } from '@/lib/reports'

import type { Currency } from '@/types'

export type CostIncreaseDriver = {
  service: string
  currentCost: number
  previousCost: number
  increase: number
  contributionPercent: number
  isNewService: boolean
}

export type ServiceAnomaly = {
  service: string
  currentCost: number
  averageCost: number
  spikeAmount: number
  spikePercent: number
  zScore: number
  severity: 'low' | 'medium' | 'high'
}

type Props = {
  drivers: CostIncreaseDriver[]
  anomalies: ServiceAnomaly[]
  currency: Currency
}

const InsightsPanel = ({ drivers, anomalies, currency }: Props) => {
  return (
    <div className="grid grid-cols-2 gap-4 mb-6">

      {/* TOP COST DRIVERS */}
      <div className="border rounded p-3">
        <h3 className="font-semibold mb-2">
          Top Cost Drivers (MoM Increase)
        </h3>

        {drivers.map(d => (
          <div key={d.service} className="flex justify-between text-sm">
            <span>
              {d.service}
              {d.isNewService && (
                <span className="ml-2 text-xs text-green-600">
                  NEW
                </span>
              )}
            </span>

            <span>
              +{formatCurrency(d.increase, currency)} ({d.contributionPercent}%)
            </span>
          </div>
        ))}
      </div>

      {/* ANOMALIES */}
      <div className="border rounded p-3">
        <h3 className="font-semibold mb-2">
          Cost Anomalies
        </h3>

        {anomalies.length === 0 ? (
          <div className="text-sm text-gray-500">
            No anomalies detected
          </div>
        ) : (
          anomalies.map(a => (
            <div key={a.service} className="text-sm mb-2">
              <div className="flex justify-between">
                <span>{a.service}</span>
                <span className={`font-medium ${a.severity === 'high'
                  ? 'text-red-600'
                  : a.severity === 'medium'
                    ? 'text-orange-500'
                    : 'text-blue-500'
                }`}>
                  {a.severity.toUpperCase()}
                </span>
              </div>

              <div className="text-xs text-gray-500">
                Spike: +{a.spikePercent}% (z={a.zScore})
              </div>
            </div>
          ))
        )}
      </div>

    </div>
  )
}

export default InsightsPanel