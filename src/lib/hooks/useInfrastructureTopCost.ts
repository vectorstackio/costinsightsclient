// lib/hooks/useInfrastructureTopCost.ts

import { useEffect, useState } from 'react'
import type { TopCostResponse } from '@/types'

export const useInfrastructureTopCost = () => {
  const [data, setData] = useState<TopCostResponse | null>(null)

  const [loading, setLoading] = useState(true)

  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(
          '/api/infrastructure/topCost'
        )

        const json = await res.json()

        setData(json)
      } catch {
        setError('Failed to load cost data')
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