// lib/ai/tools/infrastructure.ts

import { tool } from '@langchain/core/tools'
import { z } from 'zod'

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