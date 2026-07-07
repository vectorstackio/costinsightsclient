// lib/ai/tools/index.ts

import { tool } from '@langchain/core/tools'
import { z } from 'zod'

type ServiceComparison = {
  service: string
  change: number
}

type ServiceCost = {
  service: string
  cost: number
}

type Recommendation = {
  current: string
  recommended: string
}

interface MonthlyCostData {
  currentMonthCost: number
  previousMonthCost: number
  monthOverMonthChangePercent: number
  byService: ServiceCost[]
  byServiceComparison: ServiceComparison[]
  topRecommendations: Recommendation[]
}

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

    return summariseCosts(data)
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

function summariseCosts(data: MonthlyCostData) {
  return {
    summary: {
      currentMonthCost: data.currentMonthCost,
      previousMonthCost: data.previousMonthCost,
      changePercent: data.monthOverMonthChangePercent
    },

    topCostDrivers: data.byService
      .sort((a: ServiceCost, b: ServiceCost) => b.cost - a.cost)
      .slice(0, 5),

    largestChanges: data.byServiceComparison
      .sort((a: ServiceComparison, b: ServiceComparison) => a.change - b.change)
      .slice(0, 5)
      .map((item: ServiceComparison) => ({
        service: item.service,
        change: item.change
      })),

    recommendations: data.topRecommendations
      .slice(0, 5)
      .map((item: Recommendation) => ({
        action: item.recommended,
        resource: item.current
      }))
  }
}

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