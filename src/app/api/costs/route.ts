import { apiGatewayFetch } from '@/lib/aws/api-gateway'
import { withAuth } from '@/lib/auth/server'
// app/api/costs/route.ts

async function handleGET(_request: Request) {
  try {
    const res = await apiGatewayFetch(`${process.env.COST_API_URL}/summary`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    })

    if (!res.ok) {
      return Response.json(
        { error: 'Unable to load cost summary' },
        { status: res.status }
      )
    }

    const data = await res.json()

    return Response.json(data)
  } catch (err) {
    return Response.json({ err }, { status: 500 })
  }
}
export const GET = withAuth(handleGET)
