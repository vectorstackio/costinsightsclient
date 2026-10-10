// app/api/auth/route.ts

import jwt from 'jsonwebtoken'

import { NextResponse } from 'next/server'

import { PW_SALT } from '@/lib/config'

// To handle a POST request
export async function POST(req: Request) {
  try {
    const submitValues = await req.json()
    const { token } = submitValues
    if(!token) throw new Error('No token provided')

    const decoded = jwt.verify(token, PW_SALT)

    if (typeof decoded === 'string') {
      return NextResponse.json(
        { success: false, error: 'Invalid token payload' },
        { status: 403 }
      )
    }

    return NextResponse.json(
      { success: true, token },
      { status: 200 }
    )
  } catch (err: unknown) {
    if (err instanceof Error) {
      //console.error(err.message)
      return NextResponse.json({ success: false, error: err.message }, { status: 401 })
    } else {
      return NextResponse.json({ success: false, error: 'Unknown error' }, { status: 401 })
    }
  }
}