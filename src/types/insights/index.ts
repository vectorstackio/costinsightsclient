// types/insights/index.ts

import type {
  ServiceCost,
  TrendPoint,
  CostIncreaseDriver,
  ServiceAnomaly,
  RootCauseNode,
  ServiceComparison,
  TopRecommendation
} from '@/types'

export type CostInsightHealth = 'healthy' | 'warning' | 'critical'

export type CostInsightsInput = {
  period: {
    currentMonthCost: number
    previousMonthCost: number
    monthOverMonthChangePercent: number
  }

  services: ServiceCost[]
  serviceComparison: ServiceComparison[]

  drivers: CostIncreaseDriver[]
  anomalies: ServiceAnomaly[]

  trends: TrendPoint[]

  recommendations: TopRecommendation[]

  rootCause: {
    tree: RootCauseNode[]
    topChains: RootCauseNode[]
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