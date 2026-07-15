// lib/ai/tools/index.ts

import { tool } from '@langchain/core/tools'
import { z } from 'zod'

// type ServiceComparison = {
//   service: string
//   change: number
// }

// type ServiceCost = {
//   service: string
//   cost: number
// }

// type Recommendation = {
//   current: string
//   recommended: string
// }

// interface MonthlyCostData {
//   currentMonthCost: number
//   previousMonthCost: number
//   monthOverMonthChangePercent: number
//   byService: ServiceCost[]
//   byServiceComparison: ServiceComparison[]
//   topRecommendations: Recommendation[]
// }

export const getInfrastructureHealth = tool(
  async () => {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_BASE_URL}/api/infrastructure`
    )

    if (!res.ok) {
      throw new Error('Failed to fetch infrastructure health')
    }

    return await res.json()
  },
  {
    name: 'getInfrastructureHealth',
    description:
      'Returns the health metrics for running EC2 instances',
    schema: z.object({})
  }
)

export const getMonthlyCosts = tool(
  async () => {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_BASE_URL}/api/costs`
    )

    if (!res.ok) {
      throw new Error('Failed to fetch monthly costs')
    }

    const data = await res.json()

    return data
  },
  {
    name: 'getMonthlyCosts',
    description:
      'Returns AWS cost information including current costs, previous costs, trends and recommendations',
    schema: z.object({})
  }
)

export const getInfrastructureHistory = tool(
  async (
    input: {
      range?: string
    }
  ) => {

    const range = input.range ?? '24h'
    const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/infrastructure/history?range=${range}`)

    if (!res.ok) {
      throw new Error(
        'Failed to fetch infrastructure history'
      )
    }

    return await res.json()

  },
  {
    name: 'getInfrastructureHistory',

    description:
      'Returns historical CPU, memory and disk metrics for EC2 instances. Use this when the user asks about trends, history or changes over time.',

    schema: z.object({
      hours: z
        .number()
        .optional()
        .describe(
          'Number of hours of history to retrieve'
        )
    })
  }
)

export const tools = [
  getInfrastructureHealth,
  getInfrastructureHistory,
  getMonthlyCosts
]