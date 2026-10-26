// lib/auth/index.ts

export const AUTH_TOKEN_NAME = 'atk'
export const USER_ID_NAME = 'uid'

export const login = async (email: string, password: string) => {
  try {
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ email, password })
    })
    
    const data = await res.json()

    if(data.success) {
      const session = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: data.token }),
        credentials: 'same-origin'
      })
      if (!session.ok) return { success: false, error: 'Unable to establish session' }
      sessionStorage.setItem(AUTH_TOKEN_NAME, data.token)
      sessionStorage.setItem(USER_ID_NAME, data.userId)
      return { success: true}
    }
    return { success: false, error: data.error }
  } catch(err) {
    if (err instanceof Error) {
      return { success: false, error: err.message }
    }
    return { success: false, error: 'Unknown error' }
  }
}