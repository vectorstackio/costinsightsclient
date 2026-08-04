// components/insights/ExecutiveSummary.tsx

import { formatCurrency } from '@/lib/reports'

import type { Currency } from '@/types'


type Props = {
  currentCost: number
  previousCost: number
  changePercent: number
  currency: Currency
}

const ExecutiveSummary = ({
  currentCost,
  previousCost,
  changePercent,
  currency
}: Props) => {
  return (
    <div className="border rounded p-4">
      <h2 className="font-semibold">
        Executive Summary
      </h2>

      <p>
        Current spend:
        {formatCurrency(currentCost, currency)}
      </p>

      <p>
        Previous spend:
        {formatCurrency(previousCost, currency)}
      </p>

      <p>
        Change:
        {changePercent.toFixed(2)}%
      </p>
    </div>
  )
}

export default ExecutiveSummary