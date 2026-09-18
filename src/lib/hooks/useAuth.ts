// lib/hooks/useAuth.ts

import { useEffect } from 'react'

import { AUTH_TOKEN_NAME } from '@/lib/auth'

const checkToken = async (token: string) => {
  const res = await fetch('/api/auth', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ token })
  })

  const data = await res.json()
  return data.success
}

export const useAuth = (callback: (forbidden: boolean) => void) => {
  useEffect(() => {
    const doCheck = async () => {
      const token = sessionStorage.getItem(AUTH_TOKEN_NAME)

      if (!token) {
        callback(true)
        return
      }

      const allow = await checkToken(token)

      callback(!allow)
    }

    doCheck()
  }, [callback])
}