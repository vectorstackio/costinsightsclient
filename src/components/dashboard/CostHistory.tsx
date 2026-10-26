// components/CostHistory.tsx

import { formatCurrency } from '@/lib/reports/format'

import type { Currency } from '@/types'

type TrendPoint = {
  month: string
  cost: number
}

const CostHistoryPanel = ({ trend, currency }: { trend: TrendPoint[], currency: Currency }) => {
  return (
    <div className="border rounded p-4">
      <h2 className="font-semibold mb-3">
        Historical Cost Trend (6 months)
      </h2>

      <div className="flex gap-4">
        {trend.map(t => (
          <div key={t.month} className="flex-1 text-center">
            <div className="text-xs text-gray-500">
              {t.month}
            </div>
            <div className="font-bold">
              {formatCurrency(t.cost, currency)}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default CostHistoryPanel