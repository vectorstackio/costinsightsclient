import { withAuth } from '@/lib/auth/server'
// app/api/messages/route.ts

import { NextRequest, NextResponse } from 'next/server'

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400',
}

async function handleGET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const userId = searchParams.get('userId')
    const conversationId = searchParams.get('conversationId')

    if (!userId || !conversationId) {
      return Response.json(
        {
          error:
            'Missing parameters'
        },
        {
          status: 400
        }
      )
    }

    const limit = 200
    const response =
      await fetch(
        `${process.env.MESSAGE_API_URL}/db/awsCopilotMessages?userId=${encodeURIComponent(userId)}&conversationId=${encodeURIComponent(conversationId)}&limit=${limit}&tspAuthToken=${process.env.API_AUTH_TOKEN}`
      )

    if (!response.body) {
      throw new Error('No response body')
    }

    const messages = await response.json()

    return NextResponse.json(
      {
        success: true,
        data: messages,
      },
      { headers }
    )

  } catch (err) {
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : 'Unknown error',
      },
      { status: 500, headers }
    )
  }

}

async function handlePOST(req: NextRequest) {

  try {
    const body = await req.json()

    const response =
      await fetch(
        `${process.env.MESSAGE_API_URL}/db/awsCopilotMessages?tspAuthToken=${process.env.API_AUTH_TOKEN}`,
        {
          method: 'POST',
          headers: {
            'Content-Type':
              'application/json'
          },
          body:
            JSON.stringify(body)
        }
      )

    const result = await response.json()

    return NextResponse.json(
      {
        success: true,
        data: result,
      },
      { headers }
    )

  } catch (err) {
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : 'Unknown error',
      },
      { status: 500, headers }
    )
  }
    
  

  
}
export const GET = withAuth(handleGET, { userOwned: true })
export const POST = withAuth(handlePOST, { userOwned: true })
