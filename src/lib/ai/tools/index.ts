// lib/ai/tools/index.ts

import { tool } from '@langchain/core/tools'
import { z } from 'zod'

export const getInfrastructureHealth = tool(
  async () => {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_APP_URL}/api/infrastructure`
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
      `${process.env.NEXT_PUBLIC_APP_URL}/api/costs`
    )

    if (!res.ok) {
      throw new Error('Failed to fetch monthly costs')
    }

    return await res.json()
  },
  {
    name: 'getMonthlyCosts',
    description:
      'Returns AWS cost information including current costs, previous costs, trends and recommendations',
    schema: z.object({})
  }
)

export const tools = [
  getInfrastructureHealth,
  getMonthlyCosts
]

// import { tool } from '@langchain/core/tools'
// import { z } from 'zod'

// export const getInfrastructureHealth = tool(
//   async () => {

//     const response = await fetch(
//       `${process.env.NEXT_PUBLIC_APP_URL}/api/infrastructure`
//     )

//     return response.json()

//   },
//   {
//     name: 'getInfrastructureHealth',
//     description:
//       'Returns the health metrics for all running EC2 instances',
//     schema: z.object({})
//   }
// )

// // export const getInfrastructureHealth = async () => {
// //   const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/infrastructure`)

// //   if (!res.ok) {
// //     throw new Error('Failed to fetch infrastructure health')
// //   }

// //   return res.json()
// // }

// export const getMonthlyCosts = async () => {
//   const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/costs`)

//   if (!res.ok) {
//     throw new Error('Failed to fetch monthly costs')
//   }

//   return res.json()
// }

// export const tools = [
//   getInfrastructureHealth,
//   getMonthlyCosts
// ]