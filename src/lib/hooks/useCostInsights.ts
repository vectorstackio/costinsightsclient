// lib/hooks/useCostInsights.ts

import { useMemo } from 'react'

import type { SummaryResponse } from '@/types'
import { mapSummaryToInsights } from '@/lib/insights'

import type { CostInsightHealth, CostInsightsResult } from '@/types'

/**
 * Core insights hook
 * Transforms raw AWS summary → business-level insights
 */
export function useCostInsights(
  summary: SummaryResponse | null
): CostInsightsResult | null {
  return useMemo(() => {
    if (!summary) return null

    const data = mapSummaryToInsights(summary)

    const topDriver = data.drivers?.[0]
    const topAnomaly = data.anomalies?.[0]

    /**
     * -----------------------
     * Health calculation
     * -----------------------
     * Derived purely from anomaly severity
     */
    const health: CostInsightHealth =
      data.anomalies?.some(a => a.severity === 'high')
        ? 'critical'
        : data.anomalies?.some(a => a.severity === 'medium')
          ? 'warning'
          : 'healthy'

    /**
     * -----------------------
     * Savings signals
     * -----------------------
     */
    const savingsPotential = data.savings?.potential ?? 0
    const hasSavings = savingsPotential > 0

    return {
      data,
      topDriver,
      topAnomaly,
      health,
      hasSavings,
      savingsPotential
    }
  }, [summary])
}