// app/logout/page.tsx

'use client'

import { useEffect } from 'react'

import { useRouter } from 'next/navigation'
import { deleteCookie } from 'cookies-next'

import { AUTH_TOKEN_NAME, USER_ID_NAME } from '@/lib/auth'

declare global {
  interface Window {
    lastPageLoad: number | null
  }
}

const Logout = () => {
  const router = useRouter()

  useEffect(() => {
    const logoutUser = () => {
      window.lastPageLoad = null
      deleteCookie(AUTH_TOKEN_NAME)
      sessionStorage.removeItem(AUTH_TOKEN_NAME)
      sessionStorage.removeItem(USER_ID_NAME)
      router.push('/login')
    }

    const doLogout = async () => {
      try {
        logoutUser()
      } catch (err) {
        if (err instanceof Error) {
          logoutUser()
        }
        logoutUser()
      }
    }

    doLogout()
  }, [router])

  return <></>
}

export default Logout