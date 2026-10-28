import { apiGatewayFetch } from '@/lib/aws/api-gateway'
import { withAuth } from '@/lib/auth/server'
// app/api/infrastructure/route.ts

async function handleGET(_request: Request) {
  const res = await apiGatewayFetch(`${process.env.METRICS_API_URL}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json'
    }
  })

  const data = await res.json()

  return Response.json(data)
}
export const GET = withAuth(handleGET)
