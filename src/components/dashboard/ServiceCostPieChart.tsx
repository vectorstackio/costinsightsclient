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
import { useCostExplorerController } from '@/hooks/useCostExplorerController'

import type { Dimension } from '@/types'

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
// const NEXT_LEVEL_MAP: Partial<Record<Dimension, Dimension>> = {
//   SERVICE: 'USAGE_TYPE',
//   USAGE_TYPE: 'REGION',
//   REGION: 'INSTANCE_TYPE' as Dimension,
//   INSTANCE_TYPE: 'RESOURCE_ID'
// }
// const NEXT_LEVEL_MAP: Record<string, string> = {
//   SERVICE: 'USAGE_TYPE',
//   USAGE_TYPE: 'REGION',
//   REGION: 'INSTANCE_TYPE',
//   INSTANCE_TYPE: 'RESOURCE_ID'
// }

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

const ServiceCostPieChart = ({ selectedService }: Props) => {
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

  //const [stack, setStack] = useState<string[]>([ROOT_GROUP_BY])
  //const [stack, setStack] = useState<Dimension[]>(['SERVICE'])
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

  async function loadPreview(groupBy: Dimension, itemKey: string) {
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
  function drillInto(itemKey: string) {
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

  function jumpTo(index: number) {
    const trimmed = stack.slice(0, index + 1)

    setStack(trimmed)

    // reset filters up to that level
    const baseFilters = context.filters.slice(0, index)

    setFilters(baseFilters)

    const targetGroup = trimmed[trimmed.length - 1]

    setGroupBy(targetGroup)
  }

  /**
   * -----------------------
   * RENDER
   * -----------------------
   */

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
                    <span>£{item.cost.toFixed(2)}</span>
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
              formatter={(v) => `£${Number(v ?? 0).toFixed(2)}`}
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
                    £{item.cost.toFixed(2)}
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

// 'use client'

// import {
//   PieChart,
//   Pie,
//   Tooltip,
//   ResponsiveContainer,
//   Cell
// } from 'recharts'

// import { useEffect, useRef, useState } from 'react'

// /**
//  * -----------------------
//  * TYPES
//  * -----------------------
//  */

// type DrilldownItem = {
//   key: string
//   cost: number
// }

// type CostFilter = {
//   key: string
//   value: string
// }

// type DrillLevel = {
//   groupBy: string
//   filters: CostFilter[]
// }

// type DrilldownResponse = {
//   groupBy: string
//   filters: CostFilter[]
//   items: DrilldownItem[]
// }

// type PreviewState = {
//   key: string
//   items: DrilldownItem[]
// } | null

// type Props = {
//   selectedService: string | null
// }

// /**
//  * -----------------------
//  * CONFIG
//  * -----------------------
//  */

// const COLORS = [
//   '#6366f1',
//   '#22c55e',
//   '#f59e0b',
//   '#ef4444',
//   '#06b6d4',
//   '#a855f7',
//   '#84cc16'
// ]

// const NEXT_LEVEL_MAP: Record<string, string> = {
//   SERVICE: 'USAGE_TYPE',
//   USAGE_TYPE: 'REGION',
//   REGION: 'INSTANCE_TYPE',
//   INSTANCE_TYPE: 'RESOURCE_ID'
// }

// /**
//  * -----------------------
//  * CACHE
//  * -----------------------
//  */

// const drillCache = new Map<string, DrilldownItem[]>()

// function cacheKey(level: DrillLevel) {
//   return JSON.stringify(level)
// }

// /**
//  * -----------------------
//  * ROOT
//  * -----------------------
//  */

// const ROOT: DrillLevel = {
//   groupBy: 'SERVICE',
//   filters: []
// }

// /**
//  * -----------------------
//  * COMPONENT
//  * -----------------------
//  */

// const ServiceCostPieChart = ({ selectedService }: Props) => {
//   const [stack, setStack] = useState<DrillLevel[]>(() => [ROOT])
//   const [drilldown, setDrilldown] = useState<DrilldownItem[] | null>(null)
//   const [loading, setLoading] = useState(false)

//   const loaded = useRef(false)
//   const previousSelection = useRef<string | null>(null)
//   const previewCache = useRef(new Map<string, DrilldownItem[]>())

//   const [preview, setPreview] = useState<PreviewState>(null)
//   const [hovering, setHovering] = useState<string | null>(null)

//   /**
//    * Prevent stale responses overwriting newer ones
//    */
//   const requestId = useRef(0)

//   /**
//    * -----------------------
//    * LOAD LEVEL (safe + cached + race-proof)
//    * -----------------------
//    */
//   async function loadLevel(level: DrillLevel) {
//     const key = cacheKey(level)

//     if (drillCache.has(key)) {
//       setDrilldown(drillCache.get(key)!)
//       return
//     }

//     const id = ++requestId.current
//     setLoading(true)

//     try {
//       const res = await fetch('/api/costs/drilldown', {
//         method: 'POST',
//         headers: {
//           'Content-Type': 'application/json'
//         },
//         body: JSON.stringify(level)
//       })

//       const json: DrilldownResponse = await res.json()

//       // ignore stale responses
//       if (id !== requestId.current) return

//       drillCache.set(key, json.items)
//       setDrilldown(json.items)
//     } finally {
//       if (id === requestId.current) {
//         setLoading(false)
//       }
//     }
//   }

//   async function loadPreview(level: DrillLevel, itemKey: string) {
//     const nextGroupBy =
//       NEXT_LEVEL_MAP[level.groupBy] ?? 'USAGE_TYPE'

//     const previewLevel: DrillLevel = {
//       groupBy: nextGroupBy,
//       filters: [
//         ...level.filters,
//         {
//           key: level.groupBy,
//           value: itemKey
//         }
//       ]
//     }

//     const key = cacheKey(previewLevel)

//     // -----------------------
//     // 1. CACHE HIT
//     // -----------------------
//     const cached = previewCache.current.get(key)
//     if (cached) {
//       setPreview({
//         key: itemKey,
//         items: cached
//       })
//       return
//     }

//     // -----------------------
//     // 2. FETCH
//     // -----------------------
//     try {
//       const res = await fetch('/api/costs/drilldown', {
//         method: 'POST',
//         headers: {
//           'Content-Type': 'application/json'
//         },
//         body: JSON.stringify(previewLevel)
//       })

//       const json: DrilldownResponse = await res.json()

//       // -----------------------
//       // 3. CACHE RESULT
//       // -----------------------
//       previewCache.current.set(key, json.items)

//       // -----------------------
//       // 4. APPLY ONLY IF STILL RELEVANT
//       // (prevents stale hover flashes)
//       // -----------------------
//       setPreview((prev) => {
//         // if user moved off this item, ignore update
//         if (hovering !== itemKey) return prev

//         return {
//           key: itemKey,
//           items: json.items
//         }
//       })
//     } catch {
//       // intentionally silent (hover UX must never break UI)
//     }
//   }

//   /**
//    * -----------------------
//    * INIT (safe lazy init pattern)
//    * -----------------------
//    */
//   useEffect(() => {
//     if (loaded.current) return
//     loaded.current = true

//     setStack([ROOT])
//     loadLevel(ROOT)
//   }, [])

//   function handleExternalSelection(service: string) {
//     const next: DrillLevel = {
//       groupBy: 'USAGE_TYPE',
//       filters: [
//         {
//           key: 'SERVICE',
//           value: service
//         }
//       ]
//     }

//     setStack([ROOT, next])
//     loadLevel(next)
//   }

//   useEffect(() => {
//     if (
//       !selectedService ||
//       selectedService === previousSelection.current
//     ) {
//       return
//     }

//     previousSelection.current = selectedService

//     handleExternalSelection(selectedService)
//   }, [selectedService])

//   /**
//    * -----------------------
//    * DRILL DOWN
//    * -----------------------
//    */
//   function drillInto(itemKey: string) {
//     const current = stack[stack.length - 1]

//     if (!current) return // 👈 critical safety guard

//     const next: DrillLevel = {
//       groupBy: NEXT_LEVEL_MAP[current.groupBy] ?? 'USAGE_TYPE',
//       filters: [
//         ...current.filters,
//         {
//           key: current.groupBy,
//           value: itemKey
//         }
//       ]
//     }

//     const newStack = [...stack, next]
//     setStack(newStack)
//     loadLevel(next)
//   }

//   /**
//    * -----------------------
//    * BREADCRUMB JUMP (true AWS console behavior)
//    * -----------------------
//    */
//   function jumpTo(index: number) {
//     const trimmed = stack.slice(0, index + 1)
//     const target = trimmed[trimmed.length - 1]

//     setStack(trimmed)
//     loadLevel(target)
//   }

//   /**
//    * -----------------------
//    * UI
//    * -----------------------
//    */

//   return (
//     <div className="border rounded p-4">

//       {/* HEADER */}
//       <div className="mb-3">
//         <h2 className="font-semibold">Cost Distribution</h2>

//         {/* BREADCRUMB */}
//         <div className="text-xs text-gray-500 mt-2 flex flex-wrap gap-1">
//           {stack.map((level, i) => {
//             const isLast = i === stack.length - 1

//             return (
//               <span key={i} className="flex items-center">
//                 <button
//                   onClick={() => jumpTo(i)}
//                   className={`hover:underline ${isLast
//                     ? 'text-gray-900 font-medium'
//                     : 'text-blue-600'
//                   }`}
//                 >
//                   {level.groupBy}
//                 </button>

//                 {!isLast && (
//                   <span className="mx-1 text-gray-400">
//                     /
//                   </span>
//                 )}
//               </span>
//             )
//           })}
//         </div>
//       </div>

//       {selectedService && (
//         <div className="mb-4 p-3 border rounded bg-blue-50">
//           Investigating:
//           <span className="font-semibold ml-2">
//             {selectedService}
//           </span>
//         </div>
//       )}

//       {/* PIE CHART */}
//       <div className="relative" style={{ width: '100%', height: 350 }}>
//         {preview && hovering && (
//           <div className="absolute right-6 top-24 w-64 bg-white border shadow-lg rounded p-3 text-sm z-50">
//             <div className="font-semibold mb-2">
//               Preview: {hovering}
//             </div>

//             {preview.items.length === 0 ? (
//               <div className="text-gray-500">No breakdown</div>
//             ) : (
//               <div className="space-y-1">
//                 {preview.items.slice(0, 5).map((item) => (
//                   <div key={item.key} className="flex justify-between">
//                     <span className="truncate">{item.key}</span>
//                     <span>£{item.cost.toFixed(2)}</span>
//                   </div>
//                 ))}
//               </div>
//             )}
//           </div>
//         )}
//         <ResponsiveContainer>
//           <PieChart>
//             <Pie
//               data={drilldown ?? []}
//               dataKey="cost"
//               nameKey="key"
//               cx="50%"
//               cy="50%"
//               outerRadius={120}
//               onClick={(_, index) => {
//                 const item = drilldown?.[index]
//                 if (item) drillInto(item.key)
//               }}
//               onMouseEnter={(_, index) => {
//                 const item = drilldown?.[index]
//                 if (!item) return

//                 setHovering(item.key)

//                 const current = stack[stack.length - 1]
//                 loadPreview(current, item.key)
//               }}
//               onMouseLeave={() => {
//                 setHovering(null)
//                 setPreview(null)
//               }}
//             >
//               {drilldown?.map((_, index) => (
//                 <Cell
//                   key={index}
//                   fill={COLORS[index % COLORS.length]}
//                 />
//               ))}
//             </Pie>

//             <Tooltip
//               formatter={(v) =>
//                 `£${Number(v ?? 0).toFixed(2)}`
//               }
//             />
//           </PieChart>
//         </ResponsiveContainer>
//       </div>

//       {/* TABLE */}
//       <div className="mt-6 border-t pt-4">
//         <h3 className="font-semibold mb-2">
//           Level: {stack[stack.length - 1]?.groupBy}
//         </h3>

//         {loading ? (
//           <div className="text-sm text-gray-500">
//             Loading...
//           </div>
//         ) : drilldown?.length ? (
//           <table className="w-full text-sm">
//             <tbody>
//               {drilldown.map((item) => (
//                 <tr key={item.key} className="border-b">
//                   <td className="py-2">{item.key}</td>
//                   <td className="py-2">
//                     £{item.cost.toFixed(2)}
//                   </td>
//                 </tr>
//               ))}
//             </tbody>
//           </table>
//         ) : (
//           <div className="text-sm text-gray-500">
//             No data
//           </div>
//         )}

//       </div>
//     </div>
//   )
// }

// export default ServiceCostPieChart