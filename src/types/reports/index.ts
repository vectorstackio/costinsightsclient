// types/reports/index.ts

export type CostReport = {
  id: string
  period: {
    month: string
    generatedAt: string
  }

  executiveSummary: string

  keyFindings: string[]

  anomalies: unknown[]

  drivers: unknown[]

  savingsSummary: {
    totalPotential: number
    recommendationsCount: number
  }

  rootCauseNarrative: string

  metadata: {
    model: string
    version: string
  }
}