// components/CostHistory.tsx

type TrendPoint = {
  month: string
  cost: number
}

const CostHistoryPanel = ({ trend }: { trend: TrendPoint[] }) => {
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
              £{t.cost.toFixed(2)}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default CostHistoryPanel