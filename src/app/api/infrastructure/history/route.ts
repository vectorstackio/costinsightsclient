import { apiGatewayFetch } from '@/lib/aws/api-gateway'
import { withAuth } from '@/lib/auth/server'
// app/api/infrastructure/history/route.ts

async function handleGET(request: Request) {
  const { searchParams } = new URL(request.url)

  const range = searchParams.get('range') ?? '24h'
  const res = await apiGatewayFetch(`${process.env.METRICS_HISTORY_API_URL}?range=${range}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json'
    }
  })

  const data = await res.json()

  return Response.json(data)
}


export const GET = withAuth(handleGET)
