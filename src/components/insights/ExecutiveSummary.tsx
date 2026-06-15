// components/insights/ExecutiveSummary.tsx

type Props = {
  currentCost: number
  previousCost: number
  changePercent: number
}

const ExecutiveSummary = ({
  currentCost,
  previousCost,
  changePercent
}: Props) => {
  return (
    <div className="border rounded p-4">
      <h2 className="font-semibold">
        Executive Summary
      </h2>

      <p>
        Current spend:
        £{currentCost.toFixed(2)}
      </p>

      <p>
        Previous spend:
        £{previousCost.toFixed(2)}
      </p>

      <p>
        Change:
        {changePercent.toFixed(2)}%
      </p>
    </div>
  )
}

export default ExecutiveSummary