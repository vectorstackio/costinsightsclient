// lib/insights/index.ts

import type { SummaryResponse, CostInsightsInput } from '@/types'

export const mapSummaryToInsights = (summary: SummaryResponse): CostInsightsInput => {
  return {
    period: {
      currentMonthCost: summary.currentMonthCost,
      previousMonthCost: summary.previousMonthCost,
      monthOverMonthChangePercent: summary.monthOverMonthChangePercent
    },

    services: summary.byService,
    serviceComparison: summary.byServiceComparison,

    drivers: summary.topCostIncreaseDrivers,
    anomalies: summary.anomalies,

    trends: summary.trend,

    recommendations: summary.topRecommendations,

    rootCause: {
      tree: summary.rootCauseTree,
      topChains: summary.topCausalChains
    },

    savings: {
      potential: summary.potentialSavings,
      recommendationCount: summary.recommendationCount
    }
  }
}

export const buildNarrative = (summary: SummaryResponse) => {
  const driver =
    summary.topCostIncreaseDrivers[0]

  return `
    Spend changed by
    ${summary.monthOverMonthChangePercent}%.

    Largest contributor was
    ${driver.service}
    contributing
    ${driver.contributionPercent}% of
    the increase.
  `
}