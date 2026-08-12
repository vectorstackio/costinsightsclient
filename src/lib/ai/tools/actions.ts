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

export const associateElasticIp = tool(
  async ({
    allocationId,
    instanceId
  }) => {

    const res = await fetch(
      `${process.env.NEXT_PUBLIC_BASE_URL}/api/ec2/elasticips/associate`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          allocationId,
          instanceId
        })
      }
    )

    if (!res.ok) {
      throw new Error(
        'Failed to associate Elastic IP'
      )
    }

    return await res.json()
  },
  {
    name: 'associateElasticIp',

    description:
      'Associates an existing Elastic IP address with an EC2 instance. Only use this action when the user has explicitly requested that an Elastic IP should be associated with an instance.',

    schema: z.object({

      allocationId:
        z.string()
          .describe(
            'The Elastic IP allocation ID'
          ),

      instanceId:
        z.string()
          .describe(
            'The EC2 instance ID'
          )

    })
  }
)

export const allocateElasticIp = tool(
  async () => {

    const res = await fetch(
      `${process.env.NEXT_PUBLIC_BASE_URL}/api/ec2/elasticips/allocate`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      }
    )

    if (!res.ok) {
      throw new Error(
        'Failed to allocate Elastic IP'
      )
    }

    return await res.json()
  },
  {
    name: 'allocateElasticIp',

    description:
      'Allocates a new Elastic IP address in the VPC. Only use this action when the user has explicitly requested that a new Elastic IP should be allocated.',

    schema: z.object({})
  }
)

export const assignElasticIp = tool(
  async ({ instanceId }) => {

    //
    // Get the current Elastic IP inventory
    //

    const inventoryRes =
      await fetch(
        `${process.env.NEXT_PUBLIC_BASE_URL}/api/ec2/elasticips`
      )

    if (!inventoryRes.ok) {
      throw new Error(
        'Failed to retrieve Elastic IPs'
      )
    }

    const data =
      await inventoryRes.json()

    const elasticIps =
      data.elasticIps ?? []


    //
    // Check whether the target instance
    // already has an Elastic IP.
    //

    const existingInstanceIp =
      elasticIps.find(
        (ip: {
          associated: boolean
          instanceId?: string
          publicIp?: string
        }) =>
          ip.associated === true &&
          ip.instanceId === instanceId
      )


    if (existingInstanceIp) {
      return {
        success: false,
        message:
          `EC2 instance ${instanceId} already has Elastic IP ${existingInstanceIp.publicIp}. No changes were made.`,
        instanceId,
        publicIp:
          existingInstanceIp.publicIp
      }
    }


    //
    // Find an unused Elastic IP.
    //

    const spareElasticIp =
      elasticIps.find(
        (ip: {
          associated: boolean
          allocationId?: string
          publicIp?: string
        }) =>
          ip.associated === false &&
          Boolean(ip.allocationId)
      )


    //
    // Use an existing spare Elastic IP
    // if one is available.
    //

    if (spareElasticIp) {

      const associateRes =
        await fetch(
          `${process.env.NEXT_PUBLIC_BASE_URL}/api/ec2/elasticips/associate`,
          {
            method: 'POST',
            headers: {
              'Content-Type':
                'application/json'
            },
            body: JSON.stringify({
              allocationId:
                spareElasticIp.allocationId,

              instanceId
            })
          }
        )


      if (!associateRes.ok) {
        throw new Error(
          'Failed to associate existing Elastic IP'
        )
      }


      const result =
        await associateRes.json()


      return {
        success: true,

        action:
          'associated-existing',

        instanceId,

        publicIp:
          spareElasticIp.publicIp,

        allocationId:
          spareElasticIp.allocationId,

        result
      }
    }


    //
    // No spare Elastic IP exists.
    //
    // Allocate a new one.
    //

    const allocateRes =
      await fetch(
        `${process.env.NEXT_PUBLIC_BASE_URL}/api/ec2/elasticips/allocate`,
        {
          method: 'POST',
          headers: {
            'Content-Type':
              'application/json'
          }
        }
      )


    if (!allocateRes.ok) {
      throw new Error(
        'Failed to allocate Elastic IP'
      )
    }


    const allocated =
      await allocateRes.json()


    //
    // The allocation Lambda should return
    // the allocation ID.
    //

    const allocationId =
      allocated.allocationId


    const publicIp =
      allocated.publicIp


    if (!allocationId) {
      throw new Error(
        'Elastic IP was allocated but no allocation ID was returned'
      )
    }


    //
    // Associate the newly allocated EIP
    // with the target instance.
    //

    const associateRes =
      await fetch(
        `${process.env.NEXT_PUBLIC_BASE_URL}/api/ec2/elasticips/associate`,
        {
          method: 'POST',
          headers: {
            'Content-Type':
              'application/json'
          },
          body: JSON.stringify({
            allocationId,

            instanceId
          })
        }
      )


    if (!associateRes.ok) {
      throw new Error(
        'Elastic IP was allocated but could not be associated with the EC2 instance'
      )
    }


    const result =
      await associateRes.json()


    return {
      success: true,

      action:
        'allocated-and-associated',

      instanceId,

      publicIp,

      allocationId,

      result
    }
  },
  {
    name:
      'assignElasticIp',

    description:
      'Assigns an Elastic IP to an EC2 instance. If the instance already has an Elastic IP, no action is taken. If an unused Elastic IP is available, it is associated with the instance. If no unused Elastic IP is available, a new Elastic IP is allocated and then associated with the instance. Only use this action when the user has explicitly requested that an Elastic IP be assigned to an instance.',

    schema:
      z.object({
        instanceId:
          z.string()
            .describe(
              'The EC2 instance ID that should receive an Elastic IP'
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