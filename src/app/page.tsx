// app/page.tsx

'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

import { useAuth } from '@/lib/hooks/useAuth'

const HomePage = () => {
  const [forbidden, setForbidden] = useState<boolean | null>(null)

  const router = useRouter()

  useAuth(setForbidden)

  useEffect(() => {
    if (forbidden === null) {
      return
    }

    if (forbidden) {
      router.replace('/login')
      return
    }

    router.replace('/dashboard')
  }, [forbidden, router])

  return null
}

export default HomePage