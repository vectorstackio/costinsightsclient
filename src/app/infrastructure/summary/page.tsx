// app/infrastructure/summary/page.tsx

'use client'

import { useState } from 'react'

import Link from 'next/link'

import { useInfrastructureSummary } from '@/lib/hooks/useInfrastructureSummary'
import { formatCurrency } from '@/lib/reports'
import { useAuth } from '@/lib/hooks/useAuth'
import Forbidden from '@/components/Forbidden'

import type { Currency, InfrastructureSummaryInstance } from '@/types'

const MetricsSummaryPage = () => {
  const [forbidden, setForbidden] = useState(false)
  const { data, loading, error } = useInfrastructureSummary()

  useAuth(setForbidden)

  if (forbidden) {
    return <Forbidden />
  }

  if (loading) return <SummarySkeleton />

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
        {error}
      </div>
    )
  }

  if (!data) return null

  const { instances } = data

  const underutilised = instances.filter(i =>
    hasMetric(i.cpuUsedPercent) &&
    hasMetric(i.memoryUsedPercent) &&
    i.cpuUsedPercent < 10 &&
    i.memoryUsedPercent < 40
  )

  const avgCpu = averageAvailable(instances.map(i => i.cpuUsedPercent))
  const avgMemory = averageAvailable(instances.map(i => i.memoryUsedPercent))

  const assessedInstances = instances.filter(i =>
    hasMetric(i.cpuUsedPercent) && hasMetric(i.memoryUsedPercent)
  )

  const wasteScore = assessedInstances.length
    ? (underutilised.length / assessedInstances.length) * 100
    : null

  const INSTANCE_MONTHLY_COSTS: Record<string, number> = {
    't3.medium': 30,

    'm6a.large': 55,
    'm6a.xlarge': 110,

    'm6i.large': 60,
    'm6i.xlarge': 120
  }

  const calculateWaste = (instance: InfrastructureSummaryInstance) => {
    const cpu = instance.cpuUsedPercent
    const memory = instance.memoryUsedPercent

    if (!hasMetric(cpu) || !hasMetric(memory)) {
      return null
    }

    const monthlyCost = INSTANCE_MONTHLY_COSTS[instance.instanceType] ?? 0

    if (cpu < 5 && memory < 20) {
      return monthlyCost * 0.75
    }

    if (cpu < 10 && memory < 40) {
      return monthlyCost * 0.5
    }

    if (cpu < 20 && memory < 50) {
      return monthlyCost * 0.25
    }

    return 0
  }

  const estimatedMonthlyWaste = instances.reduce(
    (sum, instance) => sum + (calculateWaste(instance) ?? 0),
    0
  )

  const estimatedAnnualWaste = estimatedMonthlyWaste * 12

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold">Infrastructure Summary</h1>
        <p className="text-sm text-slate-500">
          Fleet-wide cost efficiency overview
        </p>
      </div>

      <div className="mt-4 border-b border-slate-200">
        <nav className="flex gap-6 text-sm font-medium">
          <Link href="/dashboard" className="border-b-2 border-transparent pb-2 text-slate-700">Home</Link>
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
          <Link href="/infrastructure/summary" className="border-b-2 border-blue-600 pb-2 text-blue-600">Summary</Link>
          <Link href="/infrastructure/history" className="border-b-2 border-transparent pb-2 text-slate-500 hover:text-slate-700">History</Link>
          <Link href="/infrastructure/topCost" className="border-b-2 border-transparent pb-2 text-slate-500 hover:text-slate-700">Top Cost</Link>
        </nav>
      </div>

      {/* KPI GRID */}
      <div className="grid gap-4 md:grid-cols-4">
        <Kpi title="Instances" value={instances.length} />
        <Kpi title="Avg CPU" value={formatMetric(avgCpu)} />
        <Kpi title="Avg Memory" value={formatMetric(avgMemory)} />
        <Kpi title="Waste Score" value={formatMetric(wasteScore)} />
        <Kpi title="Potential Savings" value={formatCurrency(estimatedMonthlyWaste, data?.metadata?.currency ?? 'USD')} />
        <Kpi title="Annual Savings" value={formatCurrency(estimatedAnnualWaste, data?.metadata?.currency ?? 'USD')} />
      </div>

      {/* WASTE INSIGHTS */}
      <div className="rounded-xl border bg-white p-6 shadow-sm">
        <h2 className="font-semibold">Waste Breakdown</h2>

        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <InsightCard
            label="Underutilised"
            value={underutilised.length}
            tone="amber"
          />

          <InsightCard
            label="Overprovisioned"
            value={instances.length - underutilised.length}
            tone="red"
          />

          <InsightCard
            label="Healthy"
            value={instances.length - underutilised.length}
            tone="green"
          />
        </div>
      </div>

      {/* TOP OFFENDERS */}
      <div className="rounded-xl border bg-white p-6 shadow-sm">
        <h2 className="font-semibold mb-4">Top Wasteful Instances</h2>

        <div className="space-y-2">
          {[...instances]
            .sort(
              (a, b) =>
                (a.cpuUsedPercent ?? Number.POSITIVE_INFINITY) -
                (b.cpuUsedPercent ?? Number.POSITIVE_INFINITY)
            )
            .slice(0, 5)
            .map(i => (
              <div key={i.instanceId} className="flex justify-between text-sm border-b py-2">
                <div>
                  <div className="font-medium">{i.name}</div>
                  <div className="text-xs text-slate-500">
                    {i.instanceType}
                  </div>
                </div>

                <div className="text-right text-slate-600">
                  {formatMetric(i.cpuUsedPercent)} CPU
                </div>

                <div className="text-right">
                  <div className="font-medium">
                    {formatSavings(calculateWaste(i), data.metadata?.currency ?? 'USD')}
                  </div>

                  <div className="text-xs text-slate-500">
                    {formatMetric(i.cpuUsedPercent)} CPU
                  </div>
                </div>
              </div>
            ))}
        </div>
      </div>
    </div>
  )
}

const Kpi = ({ title, value }: { title: string; value: number | string }) => (
  <div className="rounded-lg border bg-white p-4 shadow-sm">
    <div className="text-xs text-slate-500">{title}</div>
    <div className="mt-1 text-xl font-semibold">{value}</div>
  </div>
)

const InsightCard = ({
  label,
  value,
  tone
}: {
  label: string
  value: number
  tone: 'green' | 'amber' | 'red'
}) => {
  const tones = {
    green: 'text-green-600',
    amber: 'text-amber-600',
    red: 'text-red-600'
  }

  return (
    <div className="rounded-lg border p-3">
      <div className="text-xs text-slate-500">{label}</div>
      <div className={`text-lg font-semibold ${tones[tone]}`}>
        {value}
      </div>
    </div>
  )
}

const hasMetric = (value: number | null): value is number =>
  value !== null && Number.isFinite(value)

const averageAvailable = (values: Array<number | null>) => {
  const availableValues = values.filter(hasMetric)

  if (!availableValues.length) {
    return null
  }

  return availableValues.reduce((sum, value) => sum + value, 0) /
    availableValues.length
}

const formatMetric = (value: number | null) =>
  hasMetric(value) ? `${value.toFixed(1)}%` : 'Unavailable'

const formatSavings = (value: number | null, currency: Currency) =>
  hasMetric(value) ? `${formatCurrency(value, currency)}/mo` : 'Unavailable'

const SummarySkeleton = () => {
  return (
    <div className="space-y-6 p-6 animate-pulse">
      {/* Header */}
      <div>
        <div className="h-8 w-72 rounded bg-slate-200" />
        <div className="mt-2 h-4 w-96 rounded bg-slate-200" />
      </div>

      {/* KPI grid */}
      <div className="grid gap-4 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="rounded-lg border bg-white p-4 shadow-sm"
          >
            <div className="h-3 w-20 rounded bg-slate-200" />
            <div className="mt-3 h-6 w-12 rounded bg-slate-200" />
          </div>
        ))}
      </div>

      {/* Waste breakdown */}
      <div className="rounded-xl border bg-white p-6 shadow-sm">
        <div className="h-5 w-40 rounded bg-slate-200" />

        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="rounded-lg border p-3"
            >
              <div className="h-3 w-24 rounded bg-slate-200" />
              <div className="mt-3 h-6 w-10 rounded bg-slate-200" />
            </div>
          ))}
        </div>
      </div>

      {/* Top offenders */}
      <div className="rounded-xl border bg-white p-6 shadow-sm">
        <div className="h-5 w-48 rounded bg-slate-200 mb-4" />

        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="flex justify-between border-b py-3"
            >
              <div>
                <div className="h-4 w-32 rounded bg-slate-200" />
                <div className="mt-1 h-3 w-20 rounded bg-slate-200" />
              </div>

              <div className="h-4 w-16 rounded bg-slate-200" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default MetricsSummaryPage
