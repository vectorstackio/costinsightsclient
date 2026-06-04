// app/dashboard/page.tsx

'use client'

import { useEffect, useState } from 'react'

type TopRecommendation = {
  resourceType: string
  action: string
  current: string
  recommended: string
}

type CostData = {
  currentMonthCost: number
  potentialSavings: number
  recommendationCount: number
  topRecommendations: TopRecommendation[]
}

const  SkeletonCard = () => {
  return (
    <div className="p-4 border rounded animate-pulse">
      <div className="h-3 bg-gray-300 rounded w-1/3 mb-3" />
      <div className="h-6 bg-gray-300 rounded w-1/2" />
    </div>
  )
}

const DashboardPage = () => {
  const [data, setData] = useState<CostData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      //console.log('loading costs')
      try {
        const res = await fetch('/api/costs')
        const json = await res.json()
        setData(json)
      } catch (err: unknown) {
        throw new Error(`Failed to load dashboard - ${(err as Error).message}`)
        //console.error('Failed to load dashboard', err)
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [])

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <h1 className="text-2xl font-bold">AWS Cost Dashboard</h1>

        {/* Skeleton summary cards */}
        <div className="grid grid-cols-3 gap-4">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>

        {/* Skeleton table */}
        <div className="border rounded p-4 space-y-3">
          <div className="h-4 bg-gray-300 rounded w-1/3 animate-pulse" />

          <div className="space-y-2">
            <div className="h-3 bg-gray-300 rounded w-full animate-pulse" />
            <div className="h-3 bg-gray-300 rounded w-5/6 animate-pulse" />
            <div className="h-3 bg-gray-300 rounded w-2/3 animate-pulse" />
          </div>
        </div>
      </div>
    )
  }

  if (!data) {
    return <div className="p-6">Failed to load data</div>
  }

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">AWS Cost Dashboard</h1>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="p-4 border rounded">
          <div className="text-sm text-gray-500">Current Cost</div>
          <div className="text-xl font-bold">
            £{data.currentMonthCost.toFixed(2)}
          </div>
        </div>

        <div className="p-4 border rounded">
          <div className="text-sm text-gray-500">Potential Savings</div>
          <div className="text-xl font-bold text-green-600">
            £{data.potentialSavings.toFixed(2)}
          </div>
        </div>

        <div className="p-4 border rounded">
          <div className="text-sm text-gray-500">Recommendations</div>
          <div className="text-xl font-bold">
            {data.recommendationCount}
          </div>
        </div>
      </div>

      {/* Recommendations table */}
      <div className="border rounded p-4">
        <h2 className="font-semibold mb-4">Top Recommendations</h2>

        <table className="w-full text-sm">
          <thead>
            <tr className="text-left border-b">
              <th className="py-2">Resource</th>
              <th className="py-2">Action</th>
              <th className="py-2">Current</th>
              <th className="py-2">Recommended</th>
            </tr>
          </thead>

          <tbody>
            {data.topRecommendations.map((item, idx) => (
              <tr key={idx} className="border-b">
                <td className="py-2">{item.resourceType}</td>
                <td className="py-2">{item.action}</td>
                <td className="py-2">{item.current}</td>
                <td className="py-2">{item.recommended}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default DashboardPage