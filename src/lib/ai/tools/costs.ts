// lib/ai/tools/costs.ts

import { tool } from '@langchain/core/tools'
import { z } from 'zod'

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