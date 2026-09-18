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

import Link from 'next/link'

import { useInfrastructureHistory } from '@/lib/hooks/useInfrastructureHistory'
import { useAuth } from '@/lib/hooks/useAuth'
import Forbidden from '@/components/Forbidden'

import type { InstanceHistory, HistoryRange } from '@/types'

const MetricsHistoryPage = () => {
  const [forbidden, setForbidden] = useState(false)
  const [range, setRange] = useState<HistoryRange>('24h')
  const { data, loading, error } = useInfrastructureHistory(range)
  useAuth(setForbidden)

  if (forbidden) {
    return <Forbidden />
  }

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

      <div className="mt-4 border-b border-slate-200">
        <nav className="flex gap-6 text-sm font-medium">
          <Link href="/dashboard" className="pb-2 text-slate-700">Home</Link>
          <Link href="/insights" className="border-b-2 border-transparent pb-2 text-slate-500 hover:text-slate-700">Insights</Link>
          <Link href="/infrastructure" className="border-b-2 border-slate-600 pb-2 text-blue-500 hover:text-blue-700">Infrastructure</Link>
          <Link href="/reports" className="border-b-2 border-transparent pb-2 text-slate-500 hover:text-slate-700">Reports</Link>
          <Link href="/copilot" className="border-b-2 border-transparent pb-2 text-slate-500 hover:text-slate-700">Copilot</Link>
        </nav>
      </div>

      <div className="mt-4 border-b border-slate-200">
        <nav className="flex gap-6 text-sm font-medium">
          <Link href="/dashboard" className="border-b-2 border-transparent pb-2 text-white">Home</Link>
          <Link href="/infrastructure" className="border-b-2 border-transparent pb-2 text-slate-500 hover:text-slate-700">Health</Link>
          <Link href="/infrastructure/summary" className="border-b-2 border-transparent pb-2 text-slate-500 hover:text-slate-700">Summary</Link>
          <Link href="/infrastructure/history" className="border-b-2 border-blue-600 pb-2 text-blue-600">History</Link>
          <Link href="/infrastructure/topCost" className="border-b-2 border-transparent pb-2 text-slate-500 hover:text-slate-700">Top Cost</Link>
        </nav>
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
    arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null
  const max = (arr: number[]) => arr.length ? Math.max(...arr) : null

  const avgCpu = avg(cpuValues)
  const avgMemory = avg(memoryValues)
  const avgDisk = avg(diskValues)

  const peakCpu = max(cpuValues)

  const isUnderutilised =
    hasMetric(avgCpu) &&
    hasMetric(avgMemory) &&
    avgCpu < 10 &&
    avgMemory < 40

  const isOverloaded =
    (hasMetric(avgCpu) && avgCpu > 80) ||
    (hasMetric(avgMemory) && avgMemory > 85) ||
    (hasMetric(avgDisk) && avgDisk > 90)

  const status =
    isOverloaded
      ? 'critical'
      : !hasMetric(avgCpu) || !hasMetric(avgMemory) || !hasMetric(avgDisk)
        ? 'unavailable'
        : isUnderutilised
          ? 'underutilised'
          : 'healthy'

  const tone =
    status === 'critical'
      ? 'critical'
      : status === 'underutilised'
        ? 'underutilised'
        : status === 'unavailable'
          ? 'unavailable'
          : 'healthy'

  let confidence: number | null = null
  let recommendation: 'downsize' | 'keep' | 'investigate' = 'keep'
  let reason = 'Insufficient metric data for a recommendation'

  if (
    hasMetric(avgCpu) &&
    hasMetric(avgMemory) &&
    hasMetric(peakCpu) &&
    avgCpu < 10 &&
    avgMemory < 40 &&
    peakCpu < 25
  ) {
    recommendation = 'downsize'
    confidence = 80 + (10 - avgCpu) * 1.2 + (40 - avgMemory) * 0.5
    reason = 'Consistently low CPU and memory utilisation'
  }

  if (
    (hasMetric(avgCpu) && avgCpu > 75) ||
    (hasMetric(avgMemory) && avgMemory > 80)
  ) {
    recommendation = 'investigate'
    confidence = 70
    reason = 'Sustained high utilisation detected'
  }

  if (confidence !== null) {
    confidence = Math.min(99, Math.max(10, confidence))
  } else if (
    hasMetric(avgCpu) &&
    hasMetric(avgMemory) &&
    hasMetric(avgDisk) &&
    hasMetric(peakCpu)
  ) {
    confidence = 10
    reason = 'Usage looks balanced'
  }

  const downgradeMap: Record<string, string> = {
    'm6a.large': 't3.medium',
    'm6a.xlarge': 'm6a.large',
    't3.medium': 't3.small'
  }

  const currentType = instance.instanceType
  const suggestedType =
    recommendation === 'downsize'
      ? downgradeMap[currentType] ?? 'smaller instance'
      : null

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
        <SummaryTile label="Avg CPU" value={formatMetric(avgCpu)} />
        <SummaryTile label="Avg Memory" value={formatMetric(avgMemory)} />
        <SummaryTile label="Avg Disk" value={formatMetric(avgDisk)} />
        <SummaryTile label="Peak CPU" value={formatMetric(peakCpu)} />

        <SummaryTile
          label="Recommendation"
          value={
            recommendation === 'downsize'
              ? `Downsize → ${suggestedType}`
              : recommendation === 'investigate'
                ? 'Investigate'
                : 'Keep as-is'
          }
          tone={tone}
        >

          <div className="mt-2">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>Confidence</span>
              <span>{formatConfidence(confidence)}</span>
            </div>

            <div className="mt-1 h-2 w-full rounded-full bg-slate-100">
              <div
                className="h-2 rounded-full bg-blue-500"
                style={{ width: `${confidence ?? 0}%` }}
              />
            </div>

            <div className="mt-1 text-xs text-slate-500">
              {reason}
            </div>
          </div>

        </SummaryTile>

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
  tone = 'neutral',
  children
}: {
  label: string
  value: string
  tone?: 'neutral' | 'healthy' | 'critical' | 'underutilised' | 'unavailable'
  children?: React.ReactNode
}) => {
  const tones = {
    neutral: 'text-slate-600',
    healthy: 'text-green-600',
    critical: 'text-red-600',
    underutilised: 'text-amber-600',
    unavailable: 'text-slate-500'
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <div className="text-xs text-slate-500">{label}</div>
      <div className={`mt-1 text-sm font-semibold ${tones[tone]}`}>
        {value}
      </div>
      {children && <div className="mt-3">{children}</div>}
    </div>
  )
}

const hasMetric = (value: number | null): value is number =>
  value !== null && Number.isFinite(value)

const formatMetric = (value: number | null) =>
  hasMetric(value) ? `${value.toFixed(1)}%` : 'Unavailable'

const formatConfidence = (value: number | null) =>
  hasMetric(value) ? `${value.toFixed(0)}%` : 'Unavailable'

export default MetricsHistoryPage
