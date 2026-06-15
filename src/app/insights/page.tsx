// app/insights/page.tsx

'use client'

import ExecutiveSummary from '@/components/insights/ExecutiveSummary'
import { useCostExplorerController } from '@/hooks/useCostExplorerController'
import InvestigationTargets from '@/components/insights/InvestigationTargets'

const InsightsPage = () => {
  const { summary, loadingSummary } =
    useCostExplorerController()

  if (loadingSummary || !summary) {
    return <div>Loading...</div>
  }

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">
        Cost Insights
      </h1>

      <ExecutiveSummary
        currentCost={summary.currentMonthCost}
        previousCost={summary.previousMonthCost}
        changePercent={
          summary.monthOverMonthChangePercent
        }
      />

      <InvestigationTargets
        drivers={summary.topCostIncreaseDrivers}
        anomalies={summary.anomalies}
      />
    </div>
  )
}

export default InsightsPage