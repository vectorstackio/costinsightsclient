// app/infrastructure/history/page.tsx

'use client'

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid
} from 'recharts'

import { useInfrastructureHistory } from '@/hooks/useInfrastructureHistory'
import type { InstanceHistory } from '@/types'

const MetricsHistoryPage = () => {
  const { data, loading, error } = useInfrastructureHistory()

  if (!data) {
    return null
  }

  if (loading) {
    return <HistorySkeleton />
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
        {error}
      </div>
    )
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold">
          Infrastructure History
        </h1>

        <p className="mt-1 text-sm text-slate-500">
          Historical CloudWatch metrics
        </p>
      </div>

      {data.instances.map(instance => (
        <InstanceHistoryCard
          key={instance.instanceId}
          instance={instance}
        />
      ))}
    </div>
  )
}

const InstanceHistoryCard = ({
  instance
}: {
  instance: InstanceHistory
}) => {
  const chartData = instance.cpu.map((cpu, index) => ({
    timestamp: new Date(
      cpu.timestamp
    ).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit'
    }),
    cpu: cpu.value,
    memory: instance.memory[index]?.value ?? null,
    disk: instance.disk[index]?.value ?? null
  }))

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-4">
        <h2 className="font-semibold">
          {instance.name}
        </h2>

        <div className="text-xs text-slate-500">
          {instance.instanceId}
        </div>
      </div>

      <div className="h-72">
        <ResponsiveContainer
          width="100%"
          height="100%"
        >
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />

            <XAxis dataKey="timestamp" />

            <YAxis
              domain={[0, 100]}
            />

            <Tooltip />

            <Line
              type="monotone"
              dataKey="cpu"
              strokeWidth={2}
              name="CPU"
            />

            <Line
              type="monotone"
              dataKey="memory"
              strokeWidth={2}
              name="Memory"
            />

            <Line
              type="monotone"
              dataKey="disk"
              strokeWidth={2}
              name="Disk"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

const HistorySkeleton = () => (
  <div className="space-y-6 p-6 animate-pulse">
    <div className="h-8 w-72 rounded bg-slate-200" />

    {Array.from({ length: 4 }).map((_, i) => (
      <div
        key={i}
        className="rounded-xl border border-slate-200 bg-white p-6"
      >
        <div className="h-5 w-48 rounded bg-slate-200" />

        <div className="mt-4 h-72 rounded bg-slate-200" />
      </div>
    ))}
  </div>
)

export default MetricsHistoryPage