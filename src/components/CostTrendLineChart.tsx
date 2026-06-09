// components/CostTrendLineChart.tsx

'use client'

import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'

type TrendPoint = {
  month: string
  cost: number
}

type Props = {
  data: TrendPoint[]
}

const CostTrendLineChart = ({ data }: Props) => {
  return (
    <div className="border rounded p-4 bg-white">
      <h2 className="font-semibold mb-3">6-Month Cost Trend</h2>

      <div style={{ width: '100%', height: 300 }}>
        <ResponsiveContainer>
          <LineChart data={data}>
            <XAxis dataKey="month" />
            <YAxis />
            <Tooltip formatter={(v) => `£${Number(v).toFixed(2)}`} />
            <Line type="monotone" dataKey="cost" stroke="#6366f1" strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

export default CostTrendLineChart