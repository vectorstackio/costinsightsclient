// hooks/useCostExplorerController.ts

'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

/**
 * -----------------------
 * Types (match your Lambda)
 * -----------------------
 */

export type Dimension =
  | 'SERVICE'
  | 'REGION'
  | 'USAGE_TYPE'
  | 'OPERATION'
  | 'LINKED_ACCOUNT'
  | 'RESOURCE_ID'

export type CostFilter = {
  key: Dimension
  value: string
}

export type DrilldownItem = {
  key: string
  cost: number
  percentageOfParent?: number
}

export type DrilldownResponse = {
  groupBy: Dimension
  nextGroupBy?: Dimension
  filters: CostFilter[]
  items: DrilldownItem[]
  total?: number
  context?: {
    depth: number
    path: CostFilter[]
    groupBy: Dimension
    nextGroupBy?: Dimension
  }
}

export type ServiceCost = {
  service: string
  cost: number
}

export type TrendPoint = {
  month: string
  cost: number
}

export type CostIncreaseDriver = {
  service: string
  currentCost: number
  previousCost: number
  increase: number
  contributionPercent: number
  isNewService: boolean
}

export type ServiceAnomaly = {
  service: string
  currentCost: number
  averageCost: number
  spikeAmount: number
  spikePercent: number
  zScore: number
  severity: 'low' | 'medium' | 'high'
}

export type RootCauseNode = {
  level: 'SERVICE' | 'REGION' | 'USAGE_TYPE' | 'OPERATION' | 'LINKED_ACCOUNT' | 'RESOURCE_ID'
  key: string
  currentCost: number
  previousCost: number
  change: number
  changePercent: number
  contributionToParent: number
  isNew?: boolean
  children?: RootCauseNode[]
}

export type ServiceComparison = {
  service: string
  currentCost: number
  previousCost: number
  change: number
  changePercent: number
}

export type TopRecommendation = {
  resourceType: string
  action: string
  current: string
  recommended: string
}

export type SummaryResponse = {
  currentMonthCost: number
  previousMonthCost: number
  monthOverMonthChangePercent: number
  byService: ServiceCost[]
  trend: TrendPoint[]
  potentialSavings: number
  recommendationCount: number
  topCostIncreaseDrivers: CostIncreaseDriver[]
  anomalies: ServiceAnomaly[]
  rootCauseTree: RootCauseNode[]
  topCausalChains: RootCauseNode[]
  byServiceComparison: ServiceComparison[]
  topRecommendations: TopRecommendation[]
}

/**
 * -----------------------
 * Controller state
 * -----------------------
 */

type State = {
  groupBy: Dimension
  filters: CostFilter[]
  selectedNode?: { key: string; level: Dimension } | null
}

/**
 * -----------------------
 * Hook
 * -----------------------
 */

export function useCostExplorerController() {
  /**
   * -----------------------
   * State (single source of truth)
   * -----------------------
   */
  const [state, setState] = useState<State>({
    groupBy: 'SERVICE',
    filters: [],
    selectedNode: null
  })

  const [summary, setSummary] = useState<SummaryResponse | null>(null)
  const [drilldown, setDrilldown] = useState<DrilldownResponse | null>(null)
  const [loadingSummary, setLoadingSummary] = useState(false)
  const [loadingDrilldown, setLoadingDrilldown] = useState(false)

  /**
   * -----------------------
   * Debounce control (prevents cascading API calls)
   * -----------------------
   */
  const debounceRef = useRef<NodeJS.Timeout | null>(null)

  const debounce = (fn: () => void, delay = 250) => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(fn, delay)
  }

  /**
   * -----------------------
   * API calls
   * -----------------------
   */

  const fetchSummary = useCallback(async () => {
    setLoadingSummary(true)
    try {
      const res = await fetch('/api/costs')
      const json = await res.json()
      setSummary(json)
    } finally {
      setLoadingSummary(false)
    }
  }, [])

  const fetchDrilldown = useCallback(
    async (groupBy: Dimension, filters: CostFilter[]) => {
      setLoadingDrilldown(true)

      try {
        const res = await fetch('/api/costs/drilldown', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            groupBy,
            filters
          })
        })

        const json = await res.json()

        setDrilldown(json)
      } finally {
        setLoadingDrilldown(false)
      }
    },
    []
  )

  /**
   * -----------------------
   * Actions (public API)
   * -----------------------
   */

  const setGroupBy = useCallback((groupBy: Dimension) => {
    setState(prev => ({ ...prev, groupBy }))
  }, [])

  const setFilters = useCallback((filters: CostFilter[]) => {
    setState(prev => ({ ...prev, filters }))
  }, [])

  const addFilter = useCallback((filter: CostFilter) => {
    setState(prev => ({
      ...prev,
      filters: [...prev.filters, filter]
    }))
  }, [])

  const removeFilter = useCallback((key: Dimension, value: string) => {
    setState(prev => ({
      ...prev,
      filters: prev.filters.filter(
        f => !(f.key === key && f.value === value)
      )
    }))
  }, [])

  const selectNode = useCallback(
    (node: { key: string; level: Dimension } | null) => {
      setState(prev => ({ ...prev, selectedNode: node }))
    },
    []
  )

  const reset = useCallback(() => {
    setState({
      groupBy: 'SERVICE',
      filters: [],
      selectedNode: null
    })
  }, [])

  /**
   * -----------------------
   * Derived state
   * -----------------------
   */

  const context = useMemo(() => {
    return {
      depth: state.filters.length,
      groupBy: state.groupBy,
      filters: state.filters,
      selectedNode: state.selectedNode
    }
  }, [state])

  /**
   * -----------------------
   * Auto-fetch SUMMARY (once)
   * -----------------------
   */
  useEffect(() => {
    const load = async () => {
      await fetchSummary()
    }

    load()
  }, [])
  // useEffect(() => {
  //   fetchSummary()
  // }, [fetchSummary])

  /**
   * -----------------------
   * Auto-fetch DRILLDOWN (reactive engine)
   * -----------------------
   */

  useEffect(() => {
    debounce(() => {
      fetchDrilldown(state.groupBy, state.filters)
    }, 150)
  }, [state.groupBy, state.filters, fetchDrilldown])

  /**
   * -----------------------
   * Node click → auto drilldown filter
   * -----------------------
   */

  const drillIntoNode = useCallback(
    (node: { key: string; level: Dimension }) => {
      setState(prev => ({
        ...prev,
        filters: [
          ...prev.filters,
          {
            key: node.level,
            value: node.key
          }
        ],
        selectedNode: node
      }))
    },
    []
  )

  /**
   * -----------------------
   * Return API (what components use)
   * -----------------------
   */

  return {
    // data
    summary,
    drilldown,

    // loading states
    loadingSummary,
    loadingDrilldown,

    // state
    context,

    // actions
    setGroupBy,
    setFilters,
    addFilter,
    removeFilter,
    selectNode,
    reset,
    drillIntoNode,

    // raw state (optional escape hatch)
    state
  }
}