// lib/hooks/useInfrastructureHistory.ts

import { useEffect, useState } from 'react'

import type { InfrastructureHistoryResponse, HistoryRange } from '@/types'

export const useInfrastructureHistory = (range: HistoryRange) => {
  const [data, setData] = useState<InfrastructureHistoryResponse | null>(null)

  const [loading, setLoading] = useState(false)

  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true)
        const res = await fetch(`/api/infrastructure/history?range=${range}`)

        const json = await res.json()

        setData(json)
      } catch {
        setError('Failed to load historical metrics')
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [range])

  return {
    data,
    loading,
    error
  }
}