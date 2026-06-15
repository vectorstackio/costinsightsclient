// app/insights/page.tsx

'use client'

import { useCostExplorerController } from '@/hooks/useCostExplorerController'
import ExecutiveSummary from '@/components/insights/ExecutiveSummary'
import InvestigationTargets from '@/components/insights/InvestigationTargets'
import RootCauseNodeView from '@/components/insights/RootCauseExplorer'
import AnomalyExplorer from '@/components/insights/AnomalyExplorer'
import Recommendations from '@/components/insights/Recommendations'

const InsightsPage = () => {
  const { summary, loadingSummary } = useCostExplorerController()

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

      <div className="border rounded p-4 bg-white">
        <h2 className="font-semibold mb-4">
          Root Cause Analysis
        </h2>

        <div className="space-y-2">
          {summary.rootCauseTree?.map((node) => (
            <RootCauseNodeView
              key={node.key}
              node={node}
            />
          ))}
        </div>
      </div>

      <AnomalyExplorer anomalies={summary.anomalies} />

      <Recommendations topRecommendations={summary.topRecommendations} />

    </div>
  )
}

export default InsightsPage