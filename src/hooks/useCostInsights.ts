// hooks/useCostInsights.ts

import { useMemo } from 'react'

import type { SummaryResponse } from '@/types'
import { mapSummaryToInsights } from '@/lib/insights'

export type CostInsightHealth = 'healthy' | 'warning' | 'critical'

export type CostInsightsInput = {
  period: {
    currentMonthCost: number
    previousMonthCost: number
    monthOverMonthChangePercent: number
  }

  services: SummaryResponse['byService']
  serviceComparison: SummaryResponse['byServiceComparison']

  drivers: SummaryResponse['topCostIncreaseDrivers']
  anomalies: SummaryResponse['anomalies']

  trends: SummaryResponse['trend']

  recommendations: SummaryResponse['topRecommendations']

  rootCause: {
    tree: SummaryResponse['rootCauseTree']
    topChains: SummaryResponse['topCausalChains']
  }

  savings: {
    potential: number
    recommendationCount: number
  }
}

export type CostInsightsResult = {
  data: CostInsightsInput

  topDriver?: CostInsightsInput['drivers'][number]
  topAnomaly?: CostInsightsInput['anomalies'][number]

  health: CostInsightHealth

  hasSavings: boolean
  savingsPotential: number
}

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