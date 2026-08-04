// components/ServiceCostPieChart.tsx

'use client'

import {
  PieChart,
  Pie,
  Tooltip,
  ResponsiveContainer,
  Cell
} from 'recharts'

import { useEffect, useRef, useState } from 'react'
import { useCostExplorerController } from '@/lib/hooks/useCostExplorerController'

import { formatCurrency } from '@/lib/reports'
import type { Dimension, Currency } from '@/types'

/**
 * -----------------------
 * TYPES (local UI only)
 * -----------------------
 */
type DrilldownItem = {
  key: string
  cost: number
}

type PreviewState = {
  key: string
  items: DrilldownItem[]
} | null

type Props = {
  selectedService: string | null
  currency: Currency
}

/**
 * -----------------------
 * CONFIG
 * -----------------------
 */

const COLORS = [
  '#6366f1',
  '#22c55e',
  '#f59e0b',
  '#ef4444',
  '#06b6d4',
  '#a855f7',
  '#84cc16'
]

const NEXT_LEVEL_MAP: Partial<Record<Dimension, Dimension>> = {
  SERVICE: 'USAGE_TYPE',
  USAGE_TYPE: 'REGION',
  REGION: 'OPERATION',
  OPERATION: 'LINKED_ACCOUNT',
  LINKED_ACCOUNT: 'RESOURCE_ID'
}

/**
 * -----------------------
 * ROOT LEVEL (now delegated)
 * -----------------------
 */
const ROOT_GROUP_BY = 'SERVICE'

/**
 * -----------------------
 * COMPONENT
 * -----------------------
 */
const ServiceCostPieChart = ({ selectedService, currency }: Props) => {
  const {
    drilldown,
    loadingDrilldown,
    context,
    setFilters,
    setGroupBy
  } = useCostExplorerController()

  /**
   * -----------------------
   * LOCAL UI STATE ONLY
   * -----------------------
   */
  const [stack, setStack] = useState<Dimension[]>(['SERVICE'])
  const [hovering, setHovering] = useState<string | null>(null)
  const [preview, setPreview] = useState<PreviewState>(null)

  const previewCache = useRef(new Map<string, DrilldownItem[]>())
  const requestId = useRef(0)
  const previousSelection = useRef<string | null>(null)

  /**
   * -----------------------
   * PREVIEW (still local, lightweight UX concern)
   * -----------------------
   */
  const loadPreview = async (groupBy: Dimension, itemKey: string) => {
    //const nextGroupBy = NEXT_LEVEL_MAP[groupBy] ?? 'USAGE_TYPE'
    const nextGroupBy: Dimension = NEXT_LEVEL_MAP[groupBy] ?? 'USAGE_TYPE'

    const level = {
      groupBy: nextGroupBy,
      filters: [
        ...context.filters,
        { key: groupBy, value: itemKey }
      ]
    }

    const cacheKey = JSON.stringify(level)

    const cached = previewCache.current.get(cacheKey)
    if (cached) {
      setPreview({ key: itemKey, items: cached })
      return
    }

    const id = ++requestId.current

    try {
      const res = await fetch('/api/costs/drilldown', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(level)
      })

      const json = await res.json()
      if (id !== requestId.current) return
      previewCache.current.set(cacheKey, json.items)

      setPreview(prev => {
        if (hovering !== itemKey) return prev

        return {
          key: itemKey,
          items: json.items
        }
      })
    } catch {
      // silent
    }
  }

  /**
   * -----------------------
   * EXTERNAL SELECTION (from dashboard)
   * -----------------------
   */

  useEffect(() => {
    if (!selectedService || selectedService === previousSelection.current) return

    previousSelection.current = selectedService

    setFilters([
      {
        key: 'SERVICE',
        value: selectedService
      }
    ])

    setStack([ROOT_GROUP_BY, 'USAGE_TYPE'])
  }, [selectedService, setFilters])

  /**
   * -----------------------
   * DRILL INTO ITEM
   * (NOW: delegate state to hook instead of local API calls)
   * -----------------------
   */
  const drillInto = (itemKey: string) => {
    const currentGroupBy = stack[stack.length - 1]
    const nextGroupBy = NEXT_LEVEL_MAP[currentGroupBy] ?? 'USAGE_TYPE'

    setFilters([
      ...context.filters,
      {
        key: currentGroupBy,
        value: itemKey
      }
    ])

    setGroupBy(nextGroupBy)
    setStack(prev => [...prev, nextGroupBy])
  }

  /**
   * -----------------------
   * BREADCRUMB NAVIGATION
   * -----------------------
   */
  const jumpTo = (index: number) => {
    const trimmed = stack.slice(0, index + 1)
    setStack(trimmed)
    // reset filters up to that level
    const baseFilters = context.filters.slice(0, index)
    setFilters(baseFilters)
    const targetGroup = trimmed[trimmed.length - 1]
    setGroupBy(targetGroup)
  }

  return (
    <div className="border rounded p-4">

      {/* HEADER */}
      <div className="mb-3">
        <h2 className="font-semibold">Cost Distribution</h2>

        <div className="text-xs text-gray-500 mt-2 flex flex-wrap gap-1">
          {stack.map((level, i) => (
            <span key={i} className="flex items-center">
              <button
                onClick={() => jumpTo(i)}
                className="text-blue-600 hover:underline"
              >
                {level}
              </button>

              {i < stack.length - 1 && (
                <span className="mx-1 text-gray-400">/</span>
              )}
            </span>
          ))}
        </div>
      </div>

      {/* EXTERNAL CONTEXT */}
      {selectedService && (
        <div className="mb-4 p-3 border rounded bg-blue-50">
          Investigating:
          <span className="font-semibold ml-2">
            {selectedService}
          </span>
        </div>
      )}

      {/* CHART */}
      <div className="relative" style={{ width: '100%', height: 350 }}>

        {/* PREVIEW */}
        {preview && hovering && (
          <div className="absolute right-6 top-24 w-64 bg-white border shadow-lg rounded p-3 text-sm z-50">
            <div className="font-semibold mb-2">
              Preview: {hovering}
            </div>

            {(preview.items ?? []).length === 0 ? (
              <div className="text-gray-500">No breakdown</div>
            ) : (
              <div className="space-y-1">
                {(preview.items ?? []).slice(0, 5).map((item) => (
                  <div key={item.key} className="flex justify-between">
                    <span className="truncate">{item.key}</span>
                    <span>{formatCurrency(item.cost, currency)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <ResponsiveContainer>
          <PieChart>
            <Pie
              data={drilldown?.items ?? []}
              dataKey="cost"
              nameKey="key"
              cx="50%"
              cy="50%"
              outerRadius={120}
              onClick={(_, index) => {
                const item = drilldown?.items?.[index]
                if (item) drillInto(item.key)
              }}
              onMouseEnter={(_, index) => {
                const item = drilldown?.items?.[index]
                if (!item) return

                setHovering(item.key)

                const currentGroup = stack[stack.length - 1]

                loadPreview(currentGroup, item.key)
              }}
              onMouseLeave={() => {
                setHovering(null)
                setPreview(null)
              }}
            >
              {drilldown?.items?.map((_, index) => (
                <Cell
                  key={index}
                  fill={COLORS[index % COLORS.length]}
                />
              ))}
            </Pie>

            <Tooltip
              formatter={(v) =>
                formatCurrency(
                  Number(v ?? 0),
                  currency
                )
              }
            />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* TABLE */}
      <div className="mt-6 border-t pt-4">
        <h3 className="font-semibold mb-2">
          Level: {stack[stack.length - 1]}
        </h3>

        {loadingDrilldown ? (
          <div className="text-sm text-gray-500">
            Loading...
          </div>
        ) : drilldown?.items?.length ? (
          <table className="w-full text-sm">
            <tbody>
              {drilldown.items.map((item) => (
                <tr key={item.key} className="border-b">
                  <td className="py-2">{item.key}</td>
                  <td className="py-2">
                    {formatCurrency(item.cost, currency)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="text-sm text-gray-500">
            No data
          </div>
        )}
      </div>
    </div>
  )
}

export default ServiceCostPieChart