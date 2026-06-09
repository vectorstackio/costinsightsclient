// app/dashboard/page.tsx

'use client'

import { useEffect, useState } from 'react'

import ServiceCostChart from '@/components/ServiceCostChart'
import ServiceCostPieChart from '@/components/ServiceCostPieChart'
import InsightsPanel from '@/components/Insights'
import CostHistoryPanel from '@/components/CostHistory'


/**
 * -----------------------
 * Types
 * -----------------------
 */

type TopRecommendation = {
  resourceType: string
  action: string
  current: string
  recommended: string
}

type ServiceCost = {
  service: string
  cost: number
}

export type CostIncreaseDriver = {
  service: string
  currentCost: number
  previousCost: number
  increase: number
  contributionPercent: number
  isNewService: boolean
}

export type ServiceAnomaly = {
  service: string
  currentCost: number
  averageCost: number
  spikeAmount: number
  spikePercent: number
  zScore: number
  severity: 'low' | 'medium' | 'high'
}

type TrendPoint = {
  month: string
  cost: number
}

type CostData = {
  currentMonthCost: number
  potentialSavings: number
  recommendationCount: number
  byService: ServiceCost[]
  topRecommendations: TopRecommendation[]
  topCostIncreaseDrivers: CostIncreaseDriver[]
  anomalies: ServiceAnomaly[]
  trend: TrendPoint[]   // 👈 ADD THIS
  monthOverMonthChangePercent: number
  previousMonthCost: number
}
// type CostData = {
//   currentMonthCost: number
//   potentialSavings: number
//   recommendationCount: number
//   byService: ServiceCost[]
//   topRecommendations: TopRecommendation[]
//   topCostIncreaseDrivers: CostIncreaseDriver[]
//   anomalies: ServiceAnomaly[]
// }

/**
 * -----------------------
 * UI helpers
 * -----------------------
 */

const SkeletonCard = () => {
  return (
    <div className="p-4 border rounded animate-pulse bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200">
      <div className="h-3 bg-gray-300 rounded w-1/3 mb-3" />
      <div className="h-6 bg-gray-300 rounded w-1/2" />
    </div>
  )
}

/**
 * -----------------------
 * Component
 * -----------------------
 */
const DashboardPage = () => {
  const [data, setData] = useState<CostData | null>(null)
  const [loading, setLoading] = useState(true)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [selectedService, setSelectedService] = useState<string | null>(null)

  /**
   * -----------------------
   * Load SUMMARY ONLY
   * -----------------------
   */
  useEffect(() => {
    async function loadSummary() {
      try {
        setLoading(true)

        const res = await fetch('/api/costs')
        const json = await res.json()

        //console.log(json)

        setData(json)
        setLastUpdated(new Date())
      } finally {
        setLoading(false)
      }
    }

    loadSummary()

    const intervalId = setInterval(loadSummary, 15 * 60 * 1000)

    return () => clearInterval(intervalId)
  }, [])

  /**
   * -----------------------
   * Loading state
   * -----------------------
   */
  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <h1 className="text-2xl font-bold">
          AWS Cost Dashboard
        </h1>

        <div className="grid grid-cols-4 gap-4">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>

        <div className="border rounded p-4 space-y-3">
          <div className="h-4 bg-gray-300 rounded w-1/3 animate-pulse" />
        </div>
      </div>
    )
  }

  if (!data) {
    return <div className="p-6">Failed to load data</div>
  }

  /**
   * Filter for charts only (pure presentation logic)
   */
  const filteredServices = [...data.byService].filter(
    (s) => s.cost > 1
  ).sort((a, b) => b.cost - a.cost)

  /**
   * -----------------------
   * UI
   * -----------------------
   */

  return (
    <div className="p-6 space-y-6">
      <h1 className="flex justify-center text-2xl font-bold">
        AWS Cost Dashboard
      </h1>

      <div className="flex justify-end text-sm text-gray-500">
        Last updated: {lastUpdated?.toLocaleTimeString()}
      </div>

      {/* -----------------------
          Summary cards
      ----------------------- */}
      <div className="grid grid-cols-3 gap-4">
        <div className="p-4 border rounded bg-white">
          <div className="text-xs text-gray-400 mb-3">COST</div>

          <div className="text-sm text-gray-500">Current Month</div>
          <div className="text-2xl font-bold">
            £{data.currentMonthCost.toFixed(2)}
          </div>

          <div className="mt-3 text-sm text-gray-500">Previous Month</div>
          <div className="text-lg text-gray-700">
            £{data.previousMonthCost.toFixed(2)}
          </div>
        </div>
        <div className="p-4 border rounded bg-white">
          <div className="text-xs text-gray-400 mb-3">CHANGE</div>

          <div className="text-sm text-gray-500">MoM Change</div>
          <div
            className={`text-2xl font-bold ${data.monthOverMonthChangePercent > 0
              ? 'text-red-600'
              : 'text-green-600'
            }`}
          >
            {data.monthOverMonthChangePercent}%
          </div>

          <div className="mt-3 text-sm text-gray-500">Absolute Change</div>
          <div className="text-lg font-medium">
            £
            {(
              data.currentMonthCost - data.previousMonthCost
            ).toFixed(2)}
          </div>

          <div className="mt-3 text-sm text-gray-500">System Health</div>
          <div className="text-sm font-medium">
            {data.anomalies?.some(a => a.severity === 'high')
              ? '⚠ Critical'
              : data.anomalies?.some(a => a.severity === 'medium')
                ? '⚠ Warning'
                : '✓ Stable'}
          </div>
        </div>
        <div className="p-4 border rounded bg-white">
          <div className="text-xs text-gray-400 mb-3">CAUSE</div>

          <div className="text-sm text-gray-500">Top Cost Driver</div>
          <div className="text-lg font-bold">
            <button
              onClick={() =>
                setSelectedService(
                  data.topCostIncreaseDrivers?.[0]?.service ?? null
                )
              }
              className={`
                font-bold
                hover:text-red-600
                ${selectedService === data.topCostIncreaseDrivers?.[0]?.service ? 'text-blue-600' : ''}
              `}
            >
              {data.topCostIncreaseDrivers?.[0]?.service ?? '—'}
            </button>
          </div>

          <div className="text-sm text-gray-500">
            +£
            {data.topCostIncreaseDrivers?.[0]?.increase?.toFixed(2) ??
              '0.00'}
          </div>

          <div className="mt-3 text-sm text-gray-500">
            Is New Service?
          </div>
          <div className="text-sm font-medium">
            {data.topCostIncreaseDrivers?.[0]?.isNewService
              ? 'Yes'
              : 'No'}
          </div>

          <div className="mt-3 text-sm text-gray-500">
            Primary Anomaly
          </div>
          <div className="text-sm font-medium">
            <button
              onClick={() =>
                setSelectedService(
                  data.anomalies?.[0]?.service ?? null
                )
              }
              className={`
                font-bold
                hover:text-red-600
                ${selectedService === data.anomalies?.[0]?.service ? 'text-blue-600' : ''}
              `}
            >
              {data.anomalies?.[0]?.service ?? 'None'}
            </button>
          </div>

          <div className="mt-3 text-sm text-gray-500">
            Optimisation Potential
          </div>
          <div className="text-sm font-bold text-green-600">
            £{data.potentialSavings.toFixed(2)}
          </div>
        </div>
      </div>

      {/* -----------------------
          Charts (NEW responsibility split)
      ----------------------- */}
      {/* <InsightsPanel
        drivers={data.topCostIncreaseDrivers}
        anomalies={data.anomalies}
      /> */}
      <CostHistoryPanel trend={data.trend} />
      <InsightsPanel
        drivers={data?.topCostIncreaseDrivers}
        anomalies={data.anomalies}
      />
      <ServiceCostChart data={filteredServices} />
      <ServiceCostPieChart selectedService={selectedService} />

      {/* -----------------------
          Recommendations
      ----------------------- */}
      <div className="border rounded p-4">
        <h2 className="font-semibold mb-4">
          Top Recommendations
        </h2>

        <table className="w-full text-sm">
          <thead>
            <tr className="text-left border-b">
              <th className="py-2">Resource</th>
              <th className="py-2">Action</th>
              <th className="py-2">Current</th>
              <th className="py-2">
                Recommended
              </th>
            </tr>
          </thead>

          <tbody>
            {data.topRecommendations.map(
              (item, idx) => (
                <tr key={idx} className="border-b">
                  <td className="py-2">
                    {item.resourceType}
                  </td>
                  <td className="py-2">
                    {item.action}
                  </td>
                  <td className="py-2">
                    {item.current}
                  </td>
                  <td className="py-2">
                    {item.recommended}
                  </td>
                </tr>
              )
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default DashboardPage