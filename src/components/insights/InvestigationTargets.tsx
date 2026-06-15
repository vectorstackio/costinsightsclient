// components/insights/InvestigationTargets.tsx

'use client'

import type {
  CostIncreaseDriver,
  ServiceAnomaly
} from '@/types'

type Props = {
  drivers: CostIncreaseDriver[]
  anomalies: ServiceAnomaly[]
}

type TargetItem = {
  title: string
  service: string
  impact: number
  reason: string
  severity?: 'low' | 'medium' | 'high'
}

export default function InvestigationTargets({
  drivers,
  anomalies
}: Props) {
  /**
   * -----------------------
   * Build investigation list
   * -----------------------
   */
  const targets: TargetItem[] = [
    ...(drivers ?? []).slice(0, 3).map(d => ({
      title: 'Cost Increase Driver',
      service: d.service,
      impact: d.increase,
      reason: d.isNewService
        ? 'New service introduced this month'
        : 'Significant month-over-month increase'
    })),

    ...(anomalies ?? []).slice(0, 3).map(a => ({
      title: 'Cost Anomaly',
      service: a.service,
      impact: a.spikeAmount,
      reason: `${a.zScore.toFixed(2)} standard deviations above baseline`,
      severity: a.severity
    }))
  ]

  if (!targets.length) {
    return (
      <div className="border rounded p-4 bg-white">
        <h2 className="font-semibold mb-2">
          Investigation Targets
        </h2>
        <p className="text-sm text-gray-500">
          No significant cost changes detected.
        </p>
      </div>
    )
  }

  return (
    <div className="border rounded p-4 bg-white">
      <h2 className="font-semibold mb-4">
        Investigation Targets
      </h2>

      <div className="space-y-3">
        {targets.map((t, idx) => (
          <div
            key={idx}
            className="p-3 border rounded flex justify-between items-start"
          >
            <div>
              <div className="font-medium">
                {t.service}
              </div>

              <div className="text-sm text-gray-500">
                {t.reason}
              </div>
            </div>

            <div className="text-right">
              <div className="font-bold">
                £{t.impact.toFixed(2)}
              </div>

              {t.severity && (
                <div
                  className={`text-xs font-medium ${t.severity === 'high'
                    ? 'text-red-600'
                    : t.severity === 'medium'
                      ? 'text-orange-500'
                      : 'text-gray-500'
                  }`}
                >
                  {t.severity.toUpperCase()}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}