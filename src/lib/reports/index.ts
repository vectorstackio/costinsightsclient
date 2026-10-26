import 'server-only'
import { internalFetch, requireSession } from '@/lib/auth/server'
import { formatCurrency } from './format'
export { formatCurrency } from './format'
// lib/reports/index.ts

import { getReportJson, saveReportJson } from '@/lib/s3/reports'
import type { SummaryResponse } from '@/types'
import { mapSummaryToInsights } from '@/lib/insights'

import type { CostInsightsInput, CostReport } from '@/types'

/**
 * -----------------------
 * BASE REPORT (deterministic)
 * -----------------------
 */
export const generateReportBase = (
  insights: CostInsightsInput,
  month: string
): CostReport => {
  const topDriver = insights.drivers[0]

  return {
    id: crypto.randomUUID(),

    period: {
      month,
      generatedAt: new Date().toISOString()
    },

    metrics: {
      currentCost: insights.period.currentMonthCost,
      previousCost: insights.period.previousMonthCost,
      monthOverMonthChangePercent:
        insights.period.monthOverMonthChangePercent,

      anomalyCount: insights.anomalies.length,
      recommendationCount: insights.savings.recommendationCount,
      potentialSavings: insights.savings.potential
    },

    narratives: {
      executiveSummary: '',
      rootCauseNarrative: '',
      driversNarrative: '',
      anomalyNarrative: '',
      recommendationsNarrative: ''
    },

    findings: [
      {
        severity: 'info',
        title: 'Total spend',
        description: formatCurrency(insights.period.currentMonthCost, insights.currency)
      },
      {
        severity: 'info',
        title: 'MoM change',
        description: `${insights.period.monthOverMonthChangePercent}%`
      },
      topDriver
        ? {
          severity: 'info',
          title: 'Top driver',
          description: `${topDriver.service} (+${formatCurrency(topDriver.increase, insights.currency)})`
        }
        : {
          severity: 'info',
          title: 'No major cost drivers identified',
          description: ''
        }
    ],

    anomalies: insights.anomalies,
    drivers: insights.drivers,

    savings: {
      totalPotential: insights.savings.potential,
      recommendationCount: insights.savings.recommendationCount,
      topRecommendations: insights.recommendations
    },

    rootCause: {
      tree: insights.rootCause?.tree ?? [],
      topChains: insights.rootCause?.topChains ?? []
    },

    metadata: {
      model: 'base-v1',
      version: '0.1',
      generatedAt: new Date().toISOString(),
      reportingMonth: month,
      currency: insights.currency,
      source: {
        type: 'aws-cost-explorer',
        region: 'us-east-1'
      }
    }

    // metadata: {
    //   model: 'base-v1',
    //   version: '0.1',
    //   generatedAt: new Date().toISOString(),
    //   reportingMonth: new Date().toISOString().slice(0, 7),
    //   currency: 'GBP',
    //   source: {
    //     type: 'aws-cost-explorer',
    //     region: 'us-east-1'
    //   }
    // }
  }
}

/**
 * -----------------------
 * AI NARRATIVE GENERATION
 * -----------------------
 */

export type NarrativeOutput = {
  executiveSummary: string
  driversNarrative: string
  anomalyNarrative: string
  recommendationsNarrative: string
  rootCauseNarrative: string
}

/**
 * IMPORTANT:
 * We force JSON output from the model to avoid parsing fragile text.
 */
export const generateNarrative = async (
  insights: CostInsightsInput
): Promise<NarrativeOutput> => {
  await requireSession()
  const prompt = `
You are a senior FinOps analyst.

Return ONLY valid JSON in this format:

{
  "executiveSummary": string,
  "driversNarrative": string,
  "anomalyNarrative": string,
  "recommendationsNarrative": string,
  "rootCauseNarrative": string
}

Rules:
- Be factual only
- Use ${insights.currency} currency
- No speculation
- Executive-level tone
- Keep concise

DATA:
${JSON.stringify(insights, null, 2)}
`.trim()

  const res = await fetch(
    'https://api.openai.com/v1/chat/completions',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-5-mini',
        temperature: 0.3,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content:
              'You are a precise FinOps analyst that outputs strictly valid JSON.'
          },
          {
            role: 'user',
            content: prompt
          }
        ]
      })
    }
  )

  const json = await res.json()

  const content =
    json.choices?.[0]?.message?.content ?? '{}'

  return JSON.parse(content) as NarrativeOutput
}

/**
 * -----------------------
 * FINAL REPORT BUILDER
 * -----------------------
 */
export const buildReport = async (
  insights: CostInsightsInput,
  month: string
): Promise<CostReport> => {
  await requireSession()
  const base =
    generateReportBase(
      insights,
      month
    )

  const narratives =
    await generateNarrative(
      insights
    )

  return {
    ...base,
    narratives,
    metadata: {
      ...base.metadata,
      model: 'gpt-4.1-mini'
    }
  }
}

// export const buildReport = async (
//   insights: CostInsightsInput
// ): Promise<CostReport> => {
//   const base = generateReportBase(insights)
//   const narratives = await generateNarrative(insights)

//   return {
//     ...base,
//     narratives,
//     metadata: {
//       ...base.metadata,
//       model: 'gpt-4.1-mini'
//     }
//   }
// }

export const getReportByMonth = async (month: string) => {
  const response = await internalFetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/reports?month=${encodeURIComponent(month)}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json'
    }
  })

  if (!response.ok) {
    throw new Error(`Failed to fetch summary: ${response.statusText}`)
  }

  const result = await response.json()

  return result
}

export const getOrCreateReport = async (
  month: string
): Promise<CostReport> => {
  await requireSession()

  /**
   * -----------------------
   * Try S3 first
   * -----------------------
   */
  const cached =
    await getReportJson(month)

  if (cached) {
    return cached as CostReport
  }

  /**
   * -----------------------
   * Fetch summary
   * -----------------------
   */
  const url = new URL(
    `${process.env.COST_API_URL}/summary`
  )

  url.searchParams.set(
    'month',
    month
  )

  const response = await fetch(
    url.toString(),
    {
      method: 'GET',
      headers: {
        'Content-Type':
          'application/json'
      }
    }
  )

  if (!response.ok) {
    throw new Error(
      `Failed to fetch summary: ${response.statusText}`
    )
  }

  const summary =
    await response.json() as SummaryResponse

  /**
   * -----------------------
   * Build report
   * -----------------------
   */
  const insights =
    mapSummaryToInsights(summary)

  const report =
    await buildReport(
      insights,
      month
    )

  /**
   * -----------------------
   * Save JSON
   * -----------------------
   */
  await saveReportJson(
    month,
    report
  )

  return report
}
