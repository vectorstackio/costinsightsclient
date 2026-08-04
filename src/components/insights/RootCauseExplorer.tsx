// components/insights/RootCauseExplorer.tsx

import { formatCurrency } from '@/lib/reports'
import type { RootCauseNode, Currency } from '@/types'

type Props = {
  node: RootCauseNode
  currency: Currency
}

const RootCauseNodeView = ({ node, currency }: Props) => {
  return (
    <div className="ml-4">
      <div className="flex justify-between">
        <div>
          {node.key}{' '}
          <span className="text-gray-500 text-sm">
            ({node.level})
          </span>
        </div>

        <div className="font-medium">
          {formatCurrency(node.currentCost, currency)}
        </div>
      </div>

      {node.children?.map(child => (
        <RootCauseNodeView
          key={child.key}
          node={child}
          currency={currency}
        />
      ))}
    </div>
  )
}

export default RootCauseNodeView