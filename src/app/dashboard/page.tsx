// app/dashboard/page.tsx

'use client'

import { useState } from 'react'

import Link from 'next/link'

import ServiceCostChart from '@/components/dashboard/ServiceCostChart'
import ServiceCostPieChart from '@/components/dashboard/ServiceCostPieChart'
import InsightsPanel from '@/components/dashboard/Insights'
import CostHistoryPanel from '@/components/dashboard/CostHistory'
import CostTrendLineChart from '@/components/dashboard/CostTrendLineChart'
import TopCostDriversChart from '@/components/dashboard/TopCostDriversChart'
import CostWaterfallChart from '@/components/dashboard/CostWaterfallChart'
import Forbidden from '@/components/Forbidden'

import { useCostExplorerController } from '@/lib/hooks/useCostExplorerController'
import { useAuth } from '@/lib/hooks/useAuth'
import { formatCurrency } from '@/lib/reports'

/**
 * -----------------------
 * Skeleton
 * -----------------------
 */
const SkeletonCard = () => (
  <div className="p-4 border rounded animate-pulse bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200">
    <div className="h-3 bg-gray-300 rounded w-1/3 mb-3" />
    <div className="h-6 bg-gray-300 rounded w-1/2" />
  </div>
)

/**
 * -----------------------
 * Page
 * -----------------------
 */
const DashboardPage = () => {
  const {
    summary,
    loadingSummary,
    summaryError,
  } = useCostExplorerController()

  const [selectedService, setSelectedService] = useState<string | null>(null)
  const [forbidden, setForbidden] = useState(false)
  const currentMonthLabel = new Date().toLocaleString('en-GB', {
    month: 'long',
    year: 'numeric'
  })

  useAuth(setForbidden)

  if (forbidden) {
    return <Forbidden />
  }

  /**
   * -----------------------
   * Loading state
   * -----------------------
   */
  if (summaryError) {
    return <div role="alert" className="p-6 text-red-700">{summaryError}</div>
  }

  if (loadingSummary || !summary) {
    return (
      <div className="p-6 space-y-6">
        <h1 className="text-2xl font-bold">TBC AWS Cost Explorer</h1>

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

  const filteredServices = summary.byService
    .filter(s => s.cost > 1)
    .sort((a, b) => b.cost - a.cost)

  const topDriver = summary.topCostIncreaseDrivers?.[0]
  const primaryAnomaly = summary.anomalies?.[0]

  /**
   * -----------------------
   * UI
   * -----------------------
   */
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">
          TBC AWS Cost Explorer for {currentMonthLabel}
        </h1>

        <div className="flex items-center gap-4">
          <Link
            href="/logout"
            className="text-sm font-medium text-blue-600 hover:text-blue-800 underline"
          > 
            Logout
          </Link>
        </div>
      </div>

      <div className="mt-4 border-b border-slate-200">
        <nav className="flex gap-6 text-sm font-medium">
          <Link href="/dashboard" className="border-b-2 border-blue-600 pb-2 text-blue-600">Home</Link>
          <Link href="/insights" className="border-b-2 border-transparent pb-2 text-slate-500 hover:text-slate-700">Insights</Link>
          <Link href="/infrastructure" className="border-b-2 border-transparent pb-2 text-slate-500 hover:text-slate-700">Infrastructure</Link>
          <Link href="/reports" className="border-b-2 border-transparent pb-2 text-slate-500 hover:text-slate-700">Reports</Link>
          <Link href="/copilot" className="border-b-2 border-transparent pb-2 text-slate-500 hover:text-slate-700">Copilot</Link>
        </nav>
      </div>

      <div className="flex justify-end text-sm text-gray-500">
        {/* hook currently doesn’t expose timestamp — keep simple */}
        Last updated: {new Date().toLocaleTimeString()}
      </div>

      {/* -----------------------
          Summary Cards
      ----------------------- */}
      <div className="grid grid-cols-3 gap-4">

        {/* COST */}
        <div className="p-4 border rounded bg-white">
          <div className="text-xs text-gray-400 mb-3">COST</div>

          <div className="text-sm text-gray-500">Current Month</div>
          <div className="text-2xl font-bold">
            {formatCurrency(
              summary.currentMonthCost,
              summary.metadata.currency
            )}
          </div>

          <div className="mt-3 text-sm text-gray-500">Previous Month</div>
          <div className="text-lg text-gray-700">
            {formatCurrency(
              summary.previousMonthCost,
              summary.metadata.currency
            )}
          </div>
        </div>

        {/* CHANGE */}
        <div className="p-4 border rounded bg-white">
          <div className="text-xs text-gray-400 mb-3">CHANGE</div>

          <div className="text-sm text-gray-500">MoM Change</div>
          <div
            className={`text-2xl font-bold ${summary.monthOverMonthChangePercent > 0
              ? 'text-red-600'
              : 'text-green-600'
            }`}
          >
            {summary.monthOverMonthChangePercent}%
          </div>

          <div className="mt-3 text-sm text-gray-500">Absolute Change</div>
          <div className="text-lg font-medium">
            {formatCurrency(
              summary.currentMonthCost - summary.previousMonthCost,
              summary.metadata.currency
            )}
          </div>

          <div className="mt-3 text-sm text-gray-500">System Health</div>
          <div className="text-sm font-medium">
            {summary.anomalies?.some(a => a.severity === 'high')
              ? '⚠ Critical'
              : summary.anomalies?.some(a => a.severity === 'medium')
                ? '⚠ Warning'
                : '✓ Stable'}
          </div>
        </div>

        {/* CAUSE */}
        <div className="p-4 border rounded bg-white">
          <div className="text-xs text-gray-400 mb-3">CAUSE</div>

          <div className="text-sm text-gray-500">Top Cost Driver</div>

          <div className="text-lg font-bold">
            <button
              onClick={() =>
                setSelectedService(topDriver?.service ?? null)
              }
              className={`
                font-bold hover:text-red-600
                ${selectedService === topDriver?.service ? 'text-blue-600' : ''}
              `}
            >
              {topDriver?.service ?? '—'}
            </button>
          </div>

          <div className="text-sm text-gray-500">
            +{formatCurrency(topDriver?.increase, summary.metadata.currency)}
          </div>

          <div className="mt-3 text-sm text-gray-500">
            Is New Service?
          </div>
          <div className="text-sm font-medium">
            {topDriver?.isNewService ? 'Yes' : 'No'}
          </div>

          <div className="mt-3 text-sm text-gray-500">
            Primary Anomaly
          </div>

          <div className="text-sm font-medium">
            <button
              onClick={() =>
                setSelectedService(primaryAnomaly?.service ?? null)
              }
              className={`
                font-bold hover:text-red-600
                ${selectedService === primaryAnomaly?.service ? 'text-blue-600' : ''}
              `}
            >
              {primaryAnomaly?.service ?? 'None'}
            </button>
          </div>

          <div className="mt-3 text-sm text-gray-500">
            Optimisation Potential
          </div>
          <div className="text-sm font-bold text-green-600">
            {formatCurrency(summary.potentialSavings, summary.metadata.currency)}
          </div>
        </div>
      </div>

      {/* -----------------------
          Charts
      ----------------------- */}
      <CostHistoryPanel trend={summary.trend} currency={summary.metadata.currency} />

      <div className="grid grid-cols-1 gap-6">
        <CostTrendLineChart data={summary.trend} currency={summary.metadata.currency} />

        <ServiceCostChart
          data={filteredServices}
          onSelectService={(service) => {
            setSelectedService(service)
          }}
          currency={summary.metadata.currency}
        />

        <div className="grid grid-cols-2 gap-6">
          <TopCostDriversChart
            data={summary.topCostIncreaseDrivers}
            onSelectService={(service) => {
              setSelectedService(service)
            }} 
            currency={summary.metadata.currency}
          />
          <CostWaterfallChart
            data={summary.byServiceComparison ?? []}
            onSelectService={(service) => {
              setSelectedService(service)
            }} 
            currency={summary.metadata.currency}
          />
        </div>
      </div>

      <InsightsPanel
        drivers={summary.topCostIncreaseDrivers}
        anomalies={summary.anomalies}
        currency={summary.metadata.currency}
      />

      <ServiceCostPieChart selectedService={selectedService} currency={summary.metadata.currency} />

    </div>
  )
}

export default DashboardPage