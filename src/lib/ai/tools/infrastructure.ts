// lib/ai/tools/infrastructure.ts

import { tool } from '@langchain/core/tools'
import { z } from 'zod'

import type { EC2Instance } from '@/types/infrastructure'

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

export const getEc2Instances = tool(
  async () => {

    const res = await fetch(
      `${process.env.NEXT_PUBLIC_BASE_URL}/api/infrastructure`
    )

    if (!res.ok) {
      throw new Error(
        'Failed to fetch EC2 instances'
      )
    }

    const data = await res.json()

    return JSON.stringify(
      data.instances.map((instance: EC2Instance) => ({
        instanceId: instance.instanceId,
        name: instance.name,
        instanceType: instance.instanceType,
        privateIp: instance.privateIp,
        cpuUsedPercent: instance.cpuUsedPercent,
        memoryUsedPercent: instance.memoryUsedPercent,
        diskUsedPercent: instance.diskUsedPercent
      })),
      null,
      2
    )
  },
  {
    name: 'getEc2Instances',
    description:
      'Returns all currently running EC2 instances with their instance details and utilisation metrics',
    schema: z.object({})
  }
)

export const getEbsVolumes = tool(
  async () => {

    const res = await fetch(
      `${process.env.NEXT_PUBLIC_BASE_URL}/api/ebs/volumes`
    )

    if (!res.ok) {
      throw new Error(
        'Failed to fetch EBS volumes'
      )
    }

    const data = await res.json()

    return JSON.stringify(
      data.volumes,
      null,
      2
    )
  },
  {
    name: 'getEbsVolumes',
    description:
      'Returns EBS volumes including size, type, encryption status and whether they are attached to EC2 instances',
    schema: z.object({})
  }
)