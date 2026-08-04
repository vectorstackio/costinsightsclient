// types/reports/index.ts

import type { TopRecommendation, CostIncreaseDriver, ServiceAnomaly, RootCauseNode, Currency } from '@/types'

export type ReportPeriod = {
  month: string
  generatedAt: string
}

export type ReportMetrics = {
  currentCost: number
  previousCost: number

  monthOverMonthChangePercent: number

  anomalyCount: number

  recommendationCount: number

  potentialSavings: number
}

export type ReportNarratives = {
  executiveSummary: string

  driversNarrative: string

  anomalyNarrative: string

  recommendationsNarrative: string

  rootCauseNarrative: string

  conclusion?: string
}

export type ReportFinding = {
  severity: 'info' | 'warning' | 'critical'

  title: string

  description: string
}

export type ReportHealth = 'healthy' | 'warning' | 'critical'

export type ReportMetadata = {
  generatedAt: string

  reportingMonth: string

  model: string

  version: string

  currency: Currency

  source: {
    type: 'aws-cost-explorer'
    region: string
  }

  executionTimeMs?: number
}

export type CostReport = {
  id: string

  period: ReportPeriod

  metrics: ReportMetrics

  narratives: ReportNarratives

  findings: ReportFinding[]

  drivers: CostIncreaseDriver[]

  anomalies: ServiceAnomaly[]

  //recommendations: TopRecommendation[]

  //rootCauseTree: RootCauseNode[]

  rootCause: {
    tree: RootCauseNode[]
    topChains: RootCauseNode[]
  }

  savings: SavingsSummary

  metadata: ReportMetadata
}

export type SavingsSummary = {
  totalPotential: number

  recommendationCount: number

  topRecommendations: TopRecommendation[]
}

export type NarrativeOutput = {
  executiveSummary: string
  driversNarrative: string
  anomalyNarrative: string
  recommendationsNarrative: string
  rootCauseNarrative: string
}

export type ReportHistoryItem = {
  month: string
  key: string
  pdfUrl: string
  generatedAt: string
}