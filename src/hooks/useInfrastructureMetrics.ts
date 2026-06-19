// hooks/useInfrastructureMetrics.ts

'use client'

import { useCallback, useEffect, useState } from 'react'

import type { ApiResponse, State } from '@/types/infrastrucure'

// export type InstanceMetrics = {
//   instanceId: string
//   name: string
//   host: string
//   privateIp: string
//   cpuUsedPercent: number | null
//   memoryUsedPercent: number | null
//   diskUsedPercent: number | null
// }

// type ApiResponse = {
//   generatedAt: string
//   instances: InstanceMetrics[]
// }

// type State = {
//   data: InstanceMetrics[]
//   loading: boolean
//   error: string | null
//   lastUpdated: string | null
// }

export function useInfrastructureMetrics(url: string) {
  const [state, setState] = useState<State>({
    data: [],
    loading: true,
    error: null,
    lastUpdated: null
  })

  const fetchData = useCallback(async () => {
    setState(prev => ({
      ...prev,
      loading: true,
      error: null
    }))

    try {
      const res = await fetch(url)

      if (!res.ok) {
        throw new Error(`Request failed: ${res.status}`)
      }

      const wrapper = await res.json()

      const data: ApiResponse = JSON.parse(wrapper.body)

      setState({
        data: data.instances,
        loading: false,
        error: null,
        lastUpdated: data.generatedAt
      })
    } catch (err) {
      setState(prev => ({
        ...prev,
        loading: false,
        error: err instanceof Error ? err.message : 'Unknown error'
      }))
    }
  }, [url])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  return {
    ...state,
    refetch: fetchData
  }
}