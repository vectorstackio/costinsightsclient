// lib/reports/index.ts

import type { CostInsightsInput, CostReport } from '@/types'

export const generateReportBase = (insights: CostInsightsInput): CostReport => {
  const topDriver = insights.drivers[0]
  //const topAnomaly = insights.anomalies[0]

  return {
    id: crypto.randomUUID(),

    period: {
      month: new Date().toISOString().slice(0, 7),
      generatedAt: new Date().toISOString()
    },

    executiveSummary: '',

    keyFindings: [
      `Total spend: £${insights.period.currentMonthCost}`,
      `MoM change: ${insights.period.monthOverMonthChangePercent}%`,
      topDriver
        ? `Top driver: ${topDriver.service} (+£${topDriver.increase})`
        : 'No major cost drivers identified'
    ],

    anomalies: insights.anomalies,
    drivers: insights.drivers,

    savingsSummary: {
      totalPotential: insights.savings.potential,
      recommendationsCount: insights.savings.recommendationCount
    },

    rootCauseNarrative: '',

    metadata: {
      model: 'base-v1',
      version: '0.1'
    }
  }
}

export const generateNarrative = async (insights: CostInsightsInput) => {
  const prompt = `
You are a senior FinOps analyst.

Write a concise monthly AWS cost report based on the data below.

Rules:
- Be factual only
- No speculation
- Use £ currency
- Keep it executive-level (not technical)
- Focus on cost drivers, anomalies, and savings opportunities

DATA:
${JSON.stringify(insights, null, 2)}

OUTPUT FORMAT:

1. EXECUTIVE SUMMARY
2. KEY COST DRIVERS
3. ANOMALIES
4. SAVINGS OPPORTUNITIES
5. ROOT CAUSE EXPLANATION
`.trim()

  // OpenAI call (example)
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'gpt-4.1-mini',
      messages: [
        {
          role: 'system',
          content:
            'You are a precise FinOps analyst that writes AWS cost reports.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.3
    })
  })

  const json = await res.json()

  const text = json.choices?.[0]?.message?.content ?? ''

  return parseNarrative(text)
}

export const generateFullReport = async (insights: CostInsightsInput) => {
  const base = generateReportBase(insights)

  const narrative = await generateNarrative(insights)

  return {
    ...base,
    executiveSummary: narrative.executiveSummary,
    keyFindings: base.keyFindings,
    rootCauseNarrative: narrative.rootCause,
    metadata: {
      ...base.metadata,
      model: 'gpt-4.1-mini'
    }
  }
}

const parseNarrative = (text: string) => {
  const sections = text.split(/\d\.\s+/)

  return {
    executiveSummary: sections[1] ?? '',
    keyDrivers: sections[2] ?? '',
    anomalies: sections[3] ?? '',
    savings: sections[4] ?? '',
    rootCause: sections[5] ?? ''
  }
}