// app/infrastructure/summary/page.tsx

'use client'

import { useInfrastructureSummary } from '@/lib/hooks/useInfrastructureSummary'

import type { InfrastructureSummaryInstance } from '@/types'

const MetricsSummaryPage = () => {
  const { data, loading, error } = useInfrastructureSummary()

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

  const avg = (arr: number[]) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0

  const underutilised = instances.filter(i =>
    (i.cpuUsedPercent ?? 0) < 10 &&
    (i.memoryUsedPercent ?? 0) < 40
  )

  const avgCpu = avg(instances.map(i => i.cpuUsedPercent ?? 0))
  const avgMemory = avg(instances.map(i => i.memoryUsedPercent ?? 0))
  //const avgDisk = avg(instances.map(i => i.diskUsedPercent ?? 0))

  const wasteScore = (underutilised.length / instances.length) * 100

  const INSTANCE_MONTHLY_COSTS: Record<string, number> = {
    't3.medium': 30,

    'm6a.large': 55,
    'm6a.xlarge': 110,

    'm6i.large': 60,
    'm6i.xlarge': 120
  }

  const calculateWaste = (instance: InfrastructureSummaryInstance) => {
    const cpu = instance.cpuUsedPercent ?? 0
    const memory = instance.memoryUsedPercent ?? 0

    const monthlyCost = INSTANCE_MONTHLY_COSTS[instance.instanceType] ?? 0

    if (cpu < 10 && memory < 40) {
      return monthlyCost * 0.5
    }

    if (cpu < 20 && memory < 50) {
      return monthlyCost * 0.25
    }

    return 0
  }

  const estimatedMonthlyWaste = instances.reduce(
    (sum, instance) => sum + calculateWaste(instance),
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

      {/* KPI GRID */}
      <div className="grid gap-4 md:grid-cols-4">
        <Kpi title="Instances" value={instances.length} />
        <Kpi title="Avg CPU" value={`${avgCpu.toFixed(1)}%`} />
        <Kpi title="Avg Memory" value={`${avgMemory.toFixed(1)}%`} />
        <Kpi title="Waste Score" value={`${wasteScore.toFixed(1)}%`} />
        <Kpi title="Potential Savings" value={`£${estimatedMonthlyWaste.toFixed(0)}/mo`} />
        <Kpi title="Annual Savings" value={`£${estimatedAnnualWaste.toFixed(0)}/yr`} />
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
                (a.cpuUsedPercent ?? 0) - (b.cpuUsedPercent ?? 0)
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
                  {i.cpuUsedPercent?.toFixed(1)}% CPU
                </div>

                <div className="text-right">
                  <div className="font-medium">
                    £{calculateWaste(i).toFixed(0)}/mo
                  </div>

                  <div className="text-xs text-slate-500">
                    {i.cpuUsedPercent?.toFixed(1)}% CPU
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