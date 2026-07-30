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
      'Returns CPU, memory and disk utilisation metrics for currently running EC2 instances only. Use this tool for performance monitoring questions, not for listing all EC2 instances or finding stopped instances.',
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

export const getEc2Inventory = tool(
  async () => {

    const res =
      await fetch(
        `${process.env.NEXT_PUBLIC_BASE_URL}/api/ec2`
      )


    if (!res.ok) {
      throw new Error(
        'Failed to fetch EC2 inventory'
      )
    }


    const data =
      await res.json()


    return JSON.stringify(
      data.instances,
      null,
      2
    )

  },
  {
    name: 'getEc2Inventory',

    description:
      'Returns the complete EC2 inventory including running, stopped, pending and other instance states. Use this tool when the user asks to list, find, or filter EC2 instances.',

    schema: z.object({})
  }
)

export const getLambdaInventory = tool(
  async () => {

    const res =
      await fetch(
        `${process.env.NEXT_PUBLIC_BASE_URL}/api/lambda`
      )


    if (!res.ok) {
      throw new Error(
        'Failed to fetch Lambda inventory'
      )
    }


    const data =
      await res.json()


    return JSON.stringify(
      data.functions,
      null,
      2
    )

  },
  {
    name: 'getLambdaInventory',

    description:
      'Returns the complete Lambda function inventory. Use this tool when the user asks to list, find, or filter Lambda functions.',

    schema: z.object({})
  }
)