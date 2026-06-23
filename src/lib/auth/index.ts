// lib/auth/index.ts

export const AUTH_TOKEN_NAME = 'atk'

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
      sessionStorage.setItem(AUTH_TOKEN_NAME, data.token)
      return { success: true}
    }
    return { success: false, error: data.error }
  } catch(err) {
    //console.error('Error during login:', err)
    if (err instanceof Error) {
      return { success: false, error: err.message }
    }
    return { success: false, error: 'Unknown error' }
  }
}