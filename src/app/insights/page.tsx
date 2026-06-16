// app/insights/page.tsx

'use client'

import Link from 'next/link'

import { useCostExplorerController } from '@/hooks/useCostExplorerController'
import { useCostInsights } from '@/hooks/useCostInsights'
import ExecutiveSummary from '@/components/insights/ExecutiveSummary'
import InvestigationTargets from '@/components/insights/InvestigationTargets'
import RootCauseNodeView from '@/components/insights/RootCauseExplorer'
import AnomalyExplorer from '@/components/insights/AnomalyExplorer'
import Recommendations from '@/components/insights/Recommendations'

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

const InsightsPage = () => {
  const { summary, loadingSummary } = useCostExplorerController()
  const insights = useCostInsights(summary)
  const currentMonthLabel = new Date().toLocaleString('en-GB', {
    month: 'long',
    year: 'numeric'
  })

  if (loadingSummary || !summary || !insights) {
    return(
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

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">
          AWS Cost Insights for {currentMonthLabel}
        </h1>

        <div className="flex items-center gap-4">
          <Link
            href="/dashboard"
            className="text-sm font-medium text-blue-600 hover:text-blue-800 underline"
          >
            View Dashboard
          </Link>

          <Link
            href="/reports"
            className="text-sm font-medium text-blue-600 hover:text-blue-800 underline"
          >
            Report History
          </Link>
        </div>
      </div>

      <ExecutiveSummary
        currentCost={insights.data.period.currentMonthCost}
        previousCost={insights.data.period.previousMonthCost}
        changePercent={insights.data.period.monthOverMonthChangePercent}
      />

      <InvestigationTargets
        drivers={insights.data.drivers}
        anomalies={insights.data.anomalies}
      />

      <div className="border rounded p-4 bg-white">
        <h2 className="font-semibold mb-4">
          Root Cause Analysis
        </h2>

        <div className="space-y-2">
          {insights.data.rootCause.tree?.map((node) => (
            <RootCauseNodeView
              key={node.key}
              node={node}
            />
          ))}
        </div>
      </div>

      <AnomalyExplorer anomalies={insights.data.anomalies} />

      <Recommendations topRecommendations={insights.data.recommendations} />

    </div>
  )
}

export default InsightsPage