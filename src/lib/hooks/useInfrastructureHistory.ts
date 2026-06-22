// lib/hooks/useInfrastructureHistory.ts

import { useEffect, useState } from 'react'

import type { InfrastructureHistoryResponse } from '@/types'

export const useInfrastructureHistory = () => {
  const [data, setData] = useState<InfrastructureHistoryResponse | null>(null)

  const [loading, setLoading] = useState(true)

  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch('/api/infrastructure/history')

        const json = await res.json()

        setData(json)
      } catch {
        setError('Failed to load historical metrics')
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [])

  return {
    data,
    loading,
    error
  }
}