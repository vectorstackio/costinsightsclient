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