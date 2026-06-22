// app/infrastructure/topCost/page.tsx

'use client'

import { useInfrastructureTopCost } from '@/lib/hooks/useInfrastructureTopCost'

import type { TopCostInstance } from '@/types'

const TopCostPage = () => {
  const { data, loading, error } =
    useInfrastructureTopCost()

  if (loading) {
    return <TopCostSkeleton />
  }

  if (error || !data) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
        {error}
      </div>
    )
  }

  const INSTANCE_COSTS: Record<string, number> = {
    't3.medium': 30,
    'm6a.large': 55,
    'm6a.xlarge': 110
  }

  const totalMonthlyCost = data.instances.reduce((sum, i) => {
    return sum + (INSTANCE_COSTS[i.instanceType] ?? 0)
  }, 0)

  const calculateWaste = (i: TopCostInstance) => {
    const cpu = i.cpuUsedPercent ?? 0
    const memory = i.memoryUsedPercent ?? 0

    const cost = INSTANCE_COSTS[i.instanceType] ?? 0

    if (cpu < 10 && memory < 40) return cost * 0.5
    if (cpu < 20 && memory < 50) return cost * 0.25

    return 0
  }

  const totalPotentialSavings = data.instances.reduce(
    (sum, i) => sum + calculateWaste(i),
    0
  )

  const enrichedInstances = data.instances.map(i => {
    const monthlyCost = INSTANCE_COSTS[i.instanceType] ?? 0

    const cpu = i.cpuUsedPercent ?? 0
    const memory = i.memoryUsedPercent ?? 0

    let estimatedWaste = 0

    if (cpu < 10 && memory < 40) {
      estimatedWaste = monthlyCost * 0.5
    } else if (cpu < 20 && memory < 50) {
      estimatedWaste = monthlyCost * 0.25
    }

    return {
      ...i,
      monthlyCost,
      estimatedWaste
    }
  })

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold">
          Infrastructure Cost Analysis
        </h1>

        <p className="mt-1 text-sm text-slate-500">
          Cost and optimisation opportunities
        </p>
      </div>

      <div className="mt-4 border-b border-slate-200">
        <nav className="flex gap-6 text-sm font-medium">
          <a href="/infrastructure" className="border-b-2 border-transparent pb-2 text-slate-500 hover:text-slate-700">Health</a>
          <a href="/infrastructure/summary" className="border-b-2 border-transparent pb-2 text-slate-500 hover:text-slate-700">Summary</a>
          <a href="/infrastructure/history" className="border-b-2 border-transparent pb-2 text-slate-500 hover:text-slate-700">History</a>
          <a href="/infrastructure/topCost" className="border-b-2 border-blue-600 pb-2 text-blue-600">Top Cost</a>
        </nav>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <MetricCard
          title='Monthly Cost'
          value={`£${totalMonthlyCost.toFixed(0)}`}
          subtitle='Estimated EC2 spend'
          trend={{
            value: 'Stable vs last period',
            direction: 'neutral'
          }}
        />
        
        <MetricCard
          title='Potential Savings'
          value={`£${totalPotentialSavings.toFixed(0)}`}
          subtitle='From underutilised instances'
          trend={{
            value: 'Down 8% after optimisation',
            direction: 'down'
          }}
        />
       
      </div>

      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b px-6 py-4">
          <h2 className="font-semibold">
            Top Cost Drivers
          </h2>
        </div>

        <div className="divide-y">
          {enrichedInstances.map(instance => (
            <div
              key={instance.instanceId}
              className="flex items-center justify-between px-6 py-4"
            >
              <div>
                <div className="font-medium">
                  {instance.name}
                </div>

                <div className="text-xs text-slate-500">
                  {instance.instanceType}
                </div>
              </div>

              <div className="text-right">
                <div className="font-semibold">
                  £{instance.monthlyCost.toFixed(0)}
                </div>

                <div className="text-xs text-slate-500">
                  £{instance.estimatedWaste.toFixed(0)}
                  {' '}recoverable
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

type MetricCardProps = {
  title: string
  value: string | number
  subtitle?: string
  trend?: {
    value: string
    direction: 'up' | 'down' | 'neutral'
  }
}

export const MetricCard = ({
  title,
  value,
  subtitle,
  trend
}: MetricCardProps) => {
  const trendColour =
    trend?.direction === 'down'
      ? 'text-green-600'
      : trend?.direction === 'up'
        ? 'text-red-600'
        : 'text-slate-500'

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      {/* Title */}
      <div className="text-sm text-slate-500">
        {title}
      </div>

      {/* Main value */}
      <div className="mt-2 text-3xl font-bold tracking-tight">
        {value}
      </div>

      {/* Subtitle */}
      {subtitle && (
        <div className="mt-1 text-xs text-slate-500">
          {subtitle}
        </div>
      )}

      {/* Optional trend */}
      {trend && (
        <div className={`mt-3 text-xs font-medium ${trendColour}`}>
          {trend.direction === 'down' && '↓ '}
          {trend.direction === 'up' && '↑ '}
          {trend.value}
        </div>
      )}
    </div>
  )
}

const TopCostSkeleton = () => {
  return (
    <div className="space-y-6 p-6 animate-pulse">
      <div>
        <div className="h-8 w-64 rounded bg-slate-200" />
        <div className="mt-2 h-4 w-80 rounded bg-slate-200" />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <div
            key={i}
            className="h-32 rounded-xl border bg-white"
          />
        ))}
      </div>

      <div className="rounded-xl border bg-white">
        <div className="space-y-4 p-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-12 rounded bg-slate-200"
            />
          ))}
        </div>
      </div>
    </div>
  )
}

export default TopCostPage

