// app/api/login/route.ts

import jwt from 'jsonwebtoken'

import { NextResponse } from 'next/server'

import { USERS, USER_IDS } from '@/lib/config'
import { PW_SALT } from '@/lib/config'

const ERROR_MSG = 'Invalid email or password'

// To handle a POST request
export async function POST(req: Request) {
  try {
    const submitValues = await req.json()
    const { email, password } = submitValues
    if(!email || ! password) throw new Error(ERROR_MSG)
    if (!USERS[email] || USERS[email] !== password) throw new Error(ERROR_MSG)
    const token = jwt.sign({ id: email }, PW_SALT, { expiresIn: '1y' })  // Sign token for one year.
    const data = { success: true, token: token, userId: USER_IDS[email] }
    return NextResponse.json(data, { status: 200 })
  } catch (err: unknown) {
    if (err instanceof Error) {
      //console.error(err.message)
      return NextResponse.json({ success: false, error: err.message }, { status: 401 })
    } else {
      return NextResponse.json({ success: false, error: 'Unknown error' }, { status: 401 })
    }
  }
}