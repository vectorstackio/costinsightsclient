// app/insights/page.tsx

'use client'

import { useCostExplorerController } from '@/hooks/useCostExplorerController'
import { useCostInsights } from '@/hooks/useCostInsights'
import ExecutiveSummary from '@/components/insights/ExecutiveSummary'
import InvestigationTargets from '@/components/insights/InvestigationTargets'
import RootCauseNodeView from '@/components/insights/RootCauseExplorer'
import AnomalyExplorer from '@/components/insights/AnomalyExplorer'
import Recommendations from '@/components/insights/Recommendations'

const InsightsPage = () => {
  const { summary, loadingSummary } = useCostExplorerController()
  const insights = useCostInsights(summary)

  if (loadingSummary || !summary || !insights) {
    return <div>Loading...</div>
  }

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">
        Cost Insights
      </h1>

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