// hooks/useInfrastructureMetrics.ts

'use client'

import { useCallback, useEffect, useState } from 'react'

import type { State } from '@/types/infrastrucure'

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

      const data = await res.json()

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