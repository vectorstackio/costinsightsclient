// app/insights/page.tsx

'use client'

import { useCostExplorerController } from '@/hooks/useCostExplorerController'

const InsightsPage = () => {
  const { summary, loadingSummary } =
    useCostExplorerController()

  if (loadingSummary || !summary) {
    return <div>Loading...</div>
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold">
        Cost Insights
      </h1>
    </div>
  )
}

export default InsightsPage