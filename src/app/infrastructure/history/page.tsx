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

import { useState } from 'react'

import { useInfrastructureHistory } from '@/lib/hooks/useInfrastructureHistory'
import type { InstanceHistory, HistoryRange } from '@/types'

const MetricsHistoryPage = () => {
  const [range, setRange] = useState<HistoryRange>('24h')
  const { data, loading, error } = useInfrastructureHistory(range)

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

      <div className="mt-4">
        <RangeSelector
          value={range}
          onChange={setRange}
        />

        {loading && (
          <span className="text-sm text-slate-500">
            Loading...
          </span>
        )}
      </div>

      {data.instances.map(instance => (
        <InstanceHistoryCard
          key={instance.instanceId}
          instance={instance}
          range={range}
        />
      ))}
    </div>
  )
}

const InstanceHistoryCard = ({
  instance,
  range
}: {
  instance: InstanceHistory,
  range: HistoryRange
}) => {
  const formatTick = (value: string) => {
    const date = new Date(value)

    if (range === '1h') {
      return date.toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit'
      })
    }

    if (range === '24h') {
      return date.toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit'
      })
    }

    if (range === '7d') {
      return date.toLocaleDateString([], {
        weekday: 'short',
        hour: '2-digit',
        minute: '2-digit'
      })
    }

    if (range === '30d') {
      return date.toLocaleDateString([], {
        day: '2-digit',
        month: 'short'
      })
    }

    return value
  }

  const cpuValues = instance.cpu.map(p => p.value)
  const memoryValues = instance.memory.map(p => p.value)
  const diskValues = instance.disk.map(p => p.value)

  const avg = (arr: number[]) =>
    arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0

  const max = (arr: number[]) =>
    arr.length ? Math.max(...arr) : 0

  const avgCpu = avg(cpuValues)
  const avgMemory = avg(memoryValues)
  const avgDisk = avg(diskValues)

  const peakCpu = max(cpuValues)

  const isUnderutilised = avgCpu < 10 && avgMemory < 40

  const isOverloaded = avgCpu > 80 || avgMemory > 85 || avgDisk > 90

  const status =
    isOverloaded
      ? 'critical'
      : isUnderutilised
        ? 'underutilised'
        : 'healthy'

  const chartData = instance.cpu.map((cpu, index) => ({
    timestamp: cpu.timestamp,
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

        <div className="text-xs text-slate-500">
          {instance.instanceType}
        </div>

        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600">
          {range}
        </span>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-5">
        <SummaryTile label="Avg CPU" value={`${avgCpu.toFixed(1)}%`} />
        <SummaryTile label="Avg Memory" value={`${avgMemory.toFixed(1)}%`} />
        <SummaryTile label="Avg Disk" value={`${avgDisk.toFixed(1)}%`} />
        <SummaryTile label="Peak CPU" value={`${peakCpu.toFixed(1)}%`} />

        <SummaryTile
          label="Right-sizing"
          value={
            status === 'underutilised'
              ? 'Underused'
              : status === 'critical'
                ? 'Overloaded'
                : 'Healthy'
          }
          tone={status}
        />
      </div>

      <div className="h-72">
        <ResponsiveContainer
          width="100%"
          height="100%"
        >
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />

            <XAxis dataKey="timestamp" tickFormatter={formatTick} />

            <YAxis
              domain={[0, 100]}
            />

            <Tooltip />

            <Line
              type="monotone"
              dataKey="cpu"
              strokeWidth={2}
              stroke="#3b82f6"
              name="CPU"
            />

            <Line
              type="monotone"
              dataKey="memory"
              strokeWidth={2}
              stroke="#10b981"
              name="Memory"
            />

            <Line
              type="monotone"
              dataKey="disk"
              strokeWidth={2}
              stroke="#f59e0b"
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

type RangeSelectorProps = {
  value: HistoryRange
  onChange: (range: HistoryRange) => void
}

const RangeSelector = ({
  value,
  onChange
}: RangeSelectorProps) => {
  const options: Array<{
    value: HistoryRange
    label: string
  }> = [
    {
      value: '1h',
      label: '1 Hour'
    },
    {
      value: '24h',
      label: '24 Hours'
    },
    {
      value: '7d',
      label: '7 Days'
    },
    {
      value: '30d',
      label: '30 Days'
    }
  ]

  return (
    <div className="inline-flex rounded-lg border border-slate-200 bg-white p-1 shadow-sm">
      {options.map(option => (
        <button
          key={option.value}
          onClick={() =>
            onChange(option.value)
          }
          className={`rounded-md px-4 py-2 text-sm font-medium transition ${value === option.value
            ? 'bg-slate-900 text-white'
            : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

const SummaryTile = ({
  label,
  value,
  tone = 'neutral'
}: {
  label: string
  value: string
  tone?: 'neutral' | 'healthy' | 'critical' | 'underutilised'
}) => {
  const tones = {
    neutral: 'text-slate-600',
    healthy: 'text-green-600',
    critical: 'text-red-600',
    underutilised: 'text-amber-600'
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <div className="text-xs text-slate-500">{label}</div>
      <div className={`mt-1 text-sm font-semibold ${tones[tone]}`}>
        {value}
      </div>
    </div>
  )
}

export default MetricsHistoryPage