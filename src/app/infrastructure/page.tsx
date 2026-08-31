// app/infrastructure/page.tsx

'use client'

import { RefreshCw } from 'lucide-react'

import { useState } from 'react'
import Link from 'next/link'

import { useInfrastructureMetrics } from '@/lib/hooks/useInfrastructureMetrics'
import { useAuth } from '@/lib/hooks/useAuth'
import Forbidden from '@/components/Forbidden'


import type { InstanceMetrics } from '@/types'

type MetricCardProps = {
  title: string
  value: string | number
  subtitle?: string
}

const InfrastructurePage = () => {
  const [forbidden, setForbidden] = useState(false)

  useAuth(setForbidden)

  const {
    data,
    loading,
    error,
    lastUpdated,
    refetch
  } = useInfrastructureMetrics('/api/infrastructure')

  if (forbidden) {
    return <Forbidden />
  }

  if (loading) {
    return <InfrastructureSkeleton />
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
        {error}
      </div>
    )
  }

  const avgCpu = averageAvailable(data.map(i => i.cpuUsedPercent))
  const avgMemory = averageAvailable(data.map(i => i.memoryUsedPercent))
  const avgDisk = averageAvailable(data.map(i => i.diskUsedPercent))

  const fleetHealth = data.reduce(
    (acc, instance) => {
      const status = getStatus(instance)

      acc[status]++
      return acc
    },
    { healthy: 0, warning: 0, critical: 0, unavailable: 0 }
  )

  // const idleInstances = data.filter(
  //   i => (i.cpuUsedPercent ?? 100) < 5
  // ).length

  return (
    <div className="space-y-6 p-6">
      {/* Header */}

      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Infrastructure Health
          </h1>

          <p className="mt-1 text-sm text-slate-500">
            CloudWatch metrics collected from EC2 instances
          </p>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-sm text-slate-500">
            Updated{' '}
            {lastUpdated
              ? new Date(lastUpdated).toLocaleString()
              : 'Unknown'}
          </div>

          <button
            onClick={refetch}
            className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-4 py-2 text-sm font-medium shadow-sm transition hover:bg-slate-50"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
        </div>

        <div className="flex items-center gap-4">
          <Link
            href="/logout"
            className="text-sm font-medium text-blue-600 hover:text-blue-800 underline"
          >
            Logout
          </Link>

        </div>
      </div>

      <div className="mt-4 border-b border-slate-200">
        <nav className="flex gap-6 text-sm font-medium">
          <Link href="/dashboard" className="border-b-2 border-transparent pb-2 text-slate-500">Home</Link>
          <Link href="/infrastructure" className="border-b-2 border-blue-600 pb-2 text-blue-600">Health</Link>
          <Link href="/infrastructure/summary" className="border-b-2 border-transparent pb-2 text-slate-500 hover:text-slate-700">Summary</Link>
          <Link href="/infrastructure/history" className="border-b-2 border-transparent pb-2 text-slate-500 hover:text-slate-700">History</Link>
          <Link href="/infrastructure/topCost" className="border-b-2 border-transparent pb-2 text-slate-500 hover:text-slate-700">Top Cost</Link>
        </nav>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="text-sm font-medium text-slate-600">
          Fleet Health
        </div>

        <div className="mt-4 grid grid-cols-3 gap-4">
          <HealthBlock
            label="Healthy"
            value={fleetHealth.healthy}
            colour="bg-emerald-500"
          />

          <HealthBlock
            label="Warning"
            value={fleetHealth.warning}
            colour="bg-amber-500"
          />

          <HealthBlock
            label="Critical"
            value={fleetHealth.critical}
            colour="bg-red-500"
          />

          <HealthBlock
            label="Unavailable"
            value={fleetHealth.unavailable}
            colour="bg-slate-400"
          />
        </div>
      </div>

      {/* Summary Cards */}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          title="Instances"
          value={data.length}
        />

        <MetricCard
          title="Average CPU"
          value={formatMetric(avgCpu)}
        />

        <MetricCard
          title="Average Memory"
          value={formatMetric(avgMemory)}
        />

        <MetricCard
          title="Average Disk"
          value={formatMetric(avgDisk)}
        />

      </div>

      {/* Main Table */}

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-6 py-4">
          <h2 className="font-semibold">
            Instance Metrics
          </h2>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-6 py-3 text-left font-medium text-slate-600">
                  Instance
                </th>

                <th className="px-6 py-3 text-left font-medium text-slate-600">
                  Type
                </th>

                <th className="px-6 py-3 text-left font-medium text-slate-600">
                  Status
                </th>

                <th className="px-6 py-3 text-right font-medium text-slate-600">
                  CPU
                </th>

                <th className="px-6 py-3 text-right font-medium text-slate-600">
                  Memory
                </th>

                <th className="px-6 py-3 text-right font-medium text-slate-600">
                  Disk
                </th>

                <th className="px-6 py-3 text-left font-medium text-slate-600">
                  Private IP
                </th>
              </tr>
            </thead>

            <tbody>
              {data.map(instance => {
                const cpu = instance.cpuUsedPercent
                const memory = instance.memoryUsedPercent
                const disk = instance.diskUsedPercent
                const isRightsize =
                  hasMetric(cpu) &&
                  hasMetric(memory) &&
                  cpu < 5 &&
                  memory < 30

                const status = getStatus(instance)

                return (
                  <tr
                    key={instance.instanceId}
                    className={`border-t border-slate-100 hover:bg-slate-50 ${isRightsize ? 'border-l-4 border-l-emerald-500 bg-emerald-50/40' : ''}`}
                  >
                    <td className="px-6 py-4">
                      <div>
                        <div className="font-medium">
                          {instance.name}
                        </div>

                        <div className="text-xs text-slate-500">
                          {instance.instanceId}
                        </div>
                        
                      </div>
                    </td>

                    <td className="px-6 py-4 text-slate-500">
                      {instance.instanceType}
                    </td>

                    <td className="px-6 py-4">
                      <StatusBadge
                        status={status}
                      />
                    </td>

                    <td className="px-6 py-4 text-right">
                      <UsageBar value={cpu} />
                    </td>

                    <td className="px-6 py-4 text-right">
                      <UsageBar value={memory} />
                    </td>

                    <td className="px-6 py-4 text-right">
                      <UsageBar value={disk} />
                    </td>

                    <td className="px-6 py-4 text-slate-500">
                      {instance.privateIp}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

const HealthBlock = ({
  label,
  value,
  colour
}: {
  label: string
  value: number
  colour: string
}) => {
  return (
    <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
      <div className="text-xs text-slate-500">
        {label}
      </div>

      <div className="mt-2 flex items-center justify-between">
        <div className="text-xl font-semibold">
          {value}
        </div>

        <div className={`h-2 w-10 rounded-full ${colour}`} />
      </div>
    </div>
  )
}

const MetricCard = ({
  title,
  value,
  subtitle
}: MetricCardProps) => {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="text-sm text-slate-500">
        {title}
      </div>

      <div className="mt-2 text-3xl font-bold">
        {value}
      </div>

      {subtitle && (
        <div className="mt-1 text-xs text-slate-500">
          {subtitle}
        </div>
      )}
    </div>
  )
}

const UsageBar = ({
  value
}: {
  value: number | null
}) => {
  if (!hasMetric(value)) {
    return <span className="text-sm text-slate-500">Unavailable</span>
  }

  return (
    <div className="flex items-center justify-end gap-3">
      {/* Label */}
      <span className="w-12 text-right text-sm text-slate-600">
        {value.toFixed(1)}%
      </span>

      {/* Bar */}
      <div className="h-2 w-24 overflow-hidden rounded-full bg-slate-100">
        <div
          className={`h-full rounded-full ${getBarColour(value)}`}
          style={{
            width: `${Math.min(value, 100)}%`
          }}
        />
      </div>
    </div>
  )
}

const StatusBadge = ({
  status
}: {
  status: 'healthy' | 'warning' | 'critical' | 'unavailable'
}) => {
  const styles = {
    healthy:
      'bg-green-100 text-green-700 border-green-200',
    warning:
      'bg-amber-100 text-amber-700 border-amber-200',
    critical:
      'bg-red-100 text-red-700 border-red-200',
    unavailable:
      'bg-slate-100 text-slate-600 border-slate-200'
  }

  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${styles[status]}`}
    >
      {status}
    </span>
  )
}

const InfrastructureSkeleton = () => {
  return (
    <div className="space-y-6 p-6 animate-pulse">
      {/* Header */}

      <div className="flex items-center justify-between">
        <div>
          <div className="h-8 w-64 rounded bg-slate-200" />
          <div className="mt-2 h-4 w-80 rounded bg-slate-200" />
        </div>

        <div className="h-10 w-28 rounded bg-slate-200" />
      </div>

      {/* Summary cards */}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="h-4 w-24 rounded bg-slate-200" />
            <div className="mt-4 h-8 w-20 rounded bg-slate-200" />
            {/* Fake utilisation bar */}
            <div className="mt-4 h-2 w-full rounded bg-slate-200" />
            <div className="mt-2 h-3 w-32 rounded bg-slate-200" />
          </div>
        ))}
      </div>

      {/* Table */}

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-6 py-4">
          <div className="h-5 w-40 rounded bg-slate-200" />
        </div>

        <div className="p-4">
          <div className="space-y-3">
            {Array.from({ length: 8 }).map((_, index) => (
              <div
                key={index}
                className="grid grid-cols-6 gap-4"
              >
                <div className="h-5 rounded bg-slate-200" />
                <div className="h-5 rounded bg-slate-200" />
                <div className="h-5 rounded bg-slate-200" />
                <div className="h-5 rounded bg-slate-200" />
                <div className="h-5 rounded bg-slate-200" />
                <div className="h-5 rounded bg-slate-200" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

const getBarColour = (value: number) => {
  if (value >= 90) return 'bg-red-500'
  if (value >= 75) return 'bg-amber-500'
  return 'bg-emerald-500'
}

const getStatus = (instance: InstanceMetrics) => {
  const cpu = instance.cpuUsedPercent
  const memory = instance.memoryUsedPercent
  const disk = instance.diskUsedPercent

  if (
    (hasMetric(cpu) && cpu > 80) ||
    (hasMetric(memory) && memory > 90) ||
    (hasMetric(disk) && disk > 90)
  ) {
    return 'critical'
  }

  if (
    (hasMetric(cpu) && cpu > 50) ||
    (hasMetric(memory) && memory > 75) ||
    (hasMetric(disk) && disk > 75)
  ) {
    return 'warning'
  }

  if (!hasMetric(cpu) || !hasMetric(memory) || !hasMetric(disk)) {
    return 'unavailable'
  }

  return 'healthy'
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

export default InfrastructurePage
