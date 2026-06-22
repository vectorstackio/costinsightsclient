// lib/hooks/useInfrastructureSummary.ts

import { useEffect, useState } from 'react'
import type { InfrastructureSummary } from '@/types'

export const useInfrastructureSummary = () => {
  const [data, setData] = useState<InfrastructureSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch('/api/infrastructure/summary')
        const json = await res.json()
        setData(json)
      } catch {
        setError('Failed to load summary')
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [])

  return { data, loading, error }
}