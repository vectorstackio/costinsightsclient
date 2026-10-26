import { withAuth } from '@/lib/auth/server'
// app/api/conversations/[id]/route.ts

import { NextRequest, NextResponse } from 'next/server'

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400',
}

async function handlePUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {

  try {
    const { id } = await params
    const body = await req.json()

    const response =
      await fetch(
        `${process.env.MESSAGE_API_URL}/db/awsCopilotConversations/${encodeURIComponent(id)}?tspAuthToken=${process.env.API_AUTH_TOKEN}`,
        {
          method: 'PUT',
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
export const PUT = withAuth(handlePUT, { userOwned: true, updateConversation: true })
