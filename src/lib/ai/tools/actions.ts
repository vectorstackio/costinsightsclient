// lib/ai/tools/actions.ts

import { tool } from '@langchain/core/tools'
import { z } from 'zod'

export const createEbsSnapshot = tool(
  async ({ volumeId }) => {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_BASE_URL}/api/ebs/snapshot`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ volumeId })
      }
    )

    if (!res.ok) {
      throw new Error('Failed to create snapshot')
    }

    return await res.json()
  },
  {
    name: 'createEbsSnapshot',
    description:
      'Creates an EBS snapshot for the specified volume.',
    schema: z.object({
      volumeId: z.string().describe('The EBS volume ID')
    })
  }
)