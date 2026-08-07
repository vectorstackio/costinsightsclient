// lib/ai/tools/infrastructure.ts

import { tool } from '@langchain/core/tools'
import { z } from 'zod'

import { calculateEbsCost } from '@/lib/costs'

import type { EC2Instance, EBSVolume } from '@/types'

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

    const volumesWithCosts =
      data.volumes.map((volume: EBSVolume) => ({
        ...volume,
        estimatedMonthlyCost:
          calculateEbsCost(volume)
      }))

    return JSON.stringify(
      volumesWithCosts,
      null,
      2
    )
  },
  {
    name: 'getEbsVolumes',
    description:
      'Returns all EBS volumes, including their state, size, type, creation date, encryption status and attached EC2 instances. Use this tool when the user asks about EBS volumes, unattached or unused volumes, orphaned storage, or opportunities to reduce EBS storage costs. Volumes whose state is "available" are not attached to any EC2 instance and may be candidates for deletion.',
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

export const getApiGatewayInventory = tool(
  async () => {

    const res =
      await fetch(
        `${process.env.NEXT_PUBLIC_BASE_URL}/api/apigateway`
      )


    if (!res.ok) {
      throw new Error(
        'Failed to fetch API Gateway inventory'
      )
    }


    const data =
      await res.json()


    return JSON.stringify(
      data,
      null,
      2
    )

  },
  {
    name: 'getApiGatewayInventory',

    description:
      'Returns the complete API Gateway inventory including REST APIs, HTTP APIs and WebSocket APIs. Use this tool when the user asks to list, find, or filter API Gateways.',

    schema: z.object({})
  }
)

export const getIdleEc2Instances = tool(
  async () => {

    const res =
      await fetch(
        `${process.env.NEXT_PUBLIC_BASE_URL}/api/ec2/idle`
      )


    if (!res.ok) {
      throw new Error(
        'Failed to fetch idle EC2 instances'
      )
    }


    const data =
      await res.json()

    return JSON.stringify(
      data,
      null,
      2
    )

  },
  {
    name: 'getIdleEc2Instances',

    description:
      'Returns EC2 instances whose average CPU utilisation has been below 5% over the last 7 days. Use this tool when the user asks to find idle, underutilised, or unused EC2 instances, or asks which instances could be stopped to save money.',

    schema: z.object({})
  }
)