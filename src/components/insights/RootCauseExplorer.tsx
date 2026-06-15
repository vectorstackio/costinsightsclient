// components/insights/RootCauseExplorer.tsx

import type { RootCauseNode } from '@/types'

type Props = {
  node: RootCauseNode
}

const RootCauseNodeView = ({ node }: Props) => {
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
          £{node.currentCost.toFixed(2)}
        </div>
      </div>

      {node.children?.map(child => (
        <RootCauseNodeView
          key={child.key}
          node={child}
        />
      ))}
    </div>
  )
}

export default RootCauseNodeView;