// lib/ai/tools/actions.ts

import { tool } from '@langchain/core/tools'
import { z } from 'zod'

export type Ec2Action =
  | 'start'
  | 'stop'
  | 'reboot'

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

export const deleteEbsVolume = tool(
  async ({ volumeId }) => {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_BASE_URL}/api/ebs/delete`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ volumeId })
      }
    )

    if (!res.ok) {
      throw new Error('Failed to delete volume')
    }

    return await res.json()
  },
  {
    name: 'deleteEbsVolume',
    description:
      'Deletes an unused EBS volume.',
    schema: z.object({
      volumeId: z.string().describe('The EBS volume ID')
    })
  }
)

export const releaseElasticIp = tool(
  async ({ allocationId }) => {

    const res = await fetch(
      `${process.env.NEXT_PUBLIC_BASE_URL}/api/ec2/elasticips/release`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          allocationId
        })
      }
    )

    if (!res.ok) {
      throw new Error(
        'Failed to release Elastic IP'
      )
    }

    return await res.json()
  },
  {
    name: 'releaseElasticIp',

    description:
      'Releases an unused Elastic IP address. Only use this action when the user has explicitly requested that an Elastic IP should be released.',

    schema: z.object({
      allocationId:
        z.string()
          .describe(
            'The Elastic IP allocation ID'
          )
    })
  }
)

export const resizeEbsVolume = tool(
  async ({
    volumeId,
    size
  }) => {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_BASE_URL}/api/ebs/resize`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          volumeId,
          size
        })
      }
    )

    if (!res.ok) {
      throw new Error('Failed to resize EBS volume')
    }

    return await res.json()
  },
  {
    name: 'resizeEbsVolume',
    description:
      'Increases the size of an EBS volume. The new size must be greater than the current size.',
    schema: z.object({
      volumeId: z.string().describe(
        'The EBS volume ID'
      ),
      size: z.number().int().positive().describe(
        'The new EBS volume size in GiB'
      )
    })
  }
)

export const expandEbsFilesystem = tool(
  async ({
    instanceId,
    volumeId
  }) => {

    const res =
      await fetch(
        `${process.env.NEXT_PUBLIC_BASE_URL}/api/ebs/expand`,
        {
          method: 'POST',

          headers: {
            'Content-Type':
              'application/json'
          },

          body: JSON.stringify({
            instanceId,
            volumeId
          })
        }
      )


    if (
      !res.ok
    ) {

      const error =
        await res.text()

      throw new Error(
        error ||
        'Failed to expand EBS filesystem'
      )

    }


    return await res.json()

  },
  {
    name:
      'expandEbsFilesystem',

    description:
      'Expands the partition and filesystem after an EBS volume has been increased in size.',

    schema:
      z.object({

        instanceId:
          z.string().describe(
            'The EC2 instance ID where the EBS volume is attached'
          ),

        volumeId:
          z.string().describe(
            'The EBS volume ID'
          )

      })
  }
)

export const stopEc2Instance = tool(
  async ({ instanceId }) =>
    performEc2Action(
      'stop',
      instanceId
    ),
  {
    name: 'stopEc2Instance',
    description: 'Stops an EC2 instance.',
    schema: z.object({
      instanceId: z.string()
    })
  }
)

export const startEc2Instance = tool(
  async ({ instanceId }) =>
    performEc2Action(
      'start',
      instanceId
    ),
  {
    name: 'startEc2Instance',
    description: 'Starts an EC2 instance.',
    schema: z.object({
      instanceId: z.string()
    })
  }
)

export const rebootEc2Instance = tool(
  async ({ instanceId }) =>
    performEc2Action(
      'reboot',
      instanceId
    ),
  {
    name: 'rebootEc2Instance',
    description: 'Reboots an EC2 instance.',
    schema: z.object({
      instanceId: z.string()
    })
  }
)

export const performEc2Action = async (
  action: Ec2Action,
  instanceId: string
) => {

  const res =
    await fetch(
      `${process.env.NEXT_PUBLIC_BASE_URL}/api/ec2`,
      {
        method: 'POST',

        headers: {
          'Content-Type':
            'application/json'
        },

        body: JSON.stringify({
          action,
          instanceId
        })
      }
    )


  if (
    !res.ok
  ) {

    const error =
      await res.text()

    throw new Error(
      error ||
      `Failed to ${action} EC2 instance`
    )

  }


  return await res.json()

}