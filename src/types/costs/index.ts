// types/costs/index.ts

/**
 * -----------------------
 * Types (match your Lambda)
 * -----------------------
 */

export type Dimension =
  | 'SERVICE'
  | 'REGION'
  | 'USAGE_TYPE'
  | 'OPERATION'
  | 'LINKED_ACCOUNT'
  | 'RESOURCE_ID'

export type CostFilter = {
  key: Dimension
  value: string
}

export type DrilldownItem = {
  key: string
  cost: number
  percentageOfParent?: number
}

export type DrilldownResponse = {
  groupBy: Dimension
  nextGroupBy?: Dimension
  filters: CostFilter[]
  items: DrilldownItem[]
  total?: number
  context?: {
    depth: number
    path: CostFilter[]
    groupBy: Dimension
    nextGroupBy?: Dimension
  }
}

export type ServiceCost = {
  service: string
  cost: number
}

export type TrendPoint = {
  month: string
  cost: number
}

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

export type RootCauseNode = {
  level: 'SERVICE' | 'REGION' | 'USAGE_TYPE' | 'OPERATION' | 'LINKED_ACCOUNT' | 'RESOURCE_ID'
  key: string
  currentCost: number
  previousCost: number
  change: number
  changePercent: number
  contributionToParent: number
  isNew?: boolean
  children?: RootCauseNode[]
}

export type ServiceComparison = {
  service: string
  currentCost: number
  previousCost: number
  change: number
  changePercent: number
}

export type TopRecommendation = {
  resourceType: string
  action: string
  current: string
  recommended: string
}

export type SummaryResponse = {
  currentMonthCost: number
  previousMonthCost: number
  monthOverMonthChangePercent: number
  byService: ServiceCost[]
  trend: TrendPoint[]
  potentialSavings: number
  recommendationCount: number
  topCostIncreaseDrivers: CostIncreaseDriver[]
  anomalies: ServiceAnomaly[]
  rootCauseTree: RootCauseNode[]
  topCausalChains: RootCauseNode[]
  byServiceComparison: ServiceComparison[]
  topRecommendations: TopRecommendation[]
}