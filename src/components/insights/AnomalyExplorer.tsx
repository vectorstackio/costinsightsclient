// components/insights/AnomalyExplorer.tsx

'use client'

import type { ServiceAnomaly } from '@/types/costs'

type Props = {
  anomalies: ServiceAnomaly[]
}

const getSeverityStyles = (severity: ServiceAnomaly['severity']) => {
  switch (severity) {
  case 'high':
    return 'border-red-200 bg-red-50 text-red-700'
  case 'medium':
    return 'border-orange-200 bg-orange-50 text-orange-700'
  default:
    return 'border-gray-200 bg-gray-50 text-gray-700'
  }
}

const getSeverityBadge = (severity: ServiceAnomaly['severity']) => {
  switch (severity) {
  case 'high':
    return 'text-red-600'
  case 'medium':
    return 'text-orange-500'
  default:
    return 'text-gray-500'
  }
}

const AnomalyExplorer = ({ anomalies }: Props) => {
  if (!anomalies || anomalies.length === 0) {
    return (
      <div className="border rounded p-4 bg-white">
        <h2 className="font-semibold mb-2">
          Anomalies
        </h2>
        <p className="text-sm text-gray-500">
          No anomalies detected in this period.
        </p>
      </div>
    )
  }

  return (
    <div className="border rounded p-4 bg-white">
      <h2 className="font-semibold mb-4">
        Cost Anomalies
      </h2>

      <div className="space-y-3">
        {anomalies
          .sort((a, b) => b.zScore - a.zScore)
          .map((a, idx) => (
            <div
              key={`${a.service}-${idx}`}
              className={`p-4 border rounded ${getSeverityStyles(
                a.severity
              )}`}
            >
              <div className="flex justify-between items-start">
                {/* LEFT SIDE */}
                <div>
                  <div className="font-medium">
                    {a.service}
                  </div>

                  <div className="text-sm mt-1 opacity-80">
                    Spike detected: {a.spikePercent.toFixed(1)}%
                    above average
                  </div>

                  <div className="text-xs mt-2 opacity-70">
                    Z-score: {a.zScore.toFixed(2)} | Avg: £
                    {a.averageCost.toFixed(2)}
                  </div>
                </div>

                {/* RIGHT SIDE */}
                <div className="text-right">
                  <div className="font-bold">
                    £{a.currentCost.toFixed(2)}
                  </div>

                  <div
                    className={`text-xs font-semibold mt-1 ${getSeverityBadge(
                      a.severity
                    )}`}
                  >
                    {a.severity.toUpperCase()}
                  </div>
                </div>
              </div>

              {/* SPIKE DETAIL BAR */}
              <div className="mt-3 text-xs text-gray-600">
                Increase: +£{a.spikeAmount.toFixed(2)}
              </div>
            </div>
          ))}
      </div>
    </div>
  )
}

export default AnomalyExplorer
