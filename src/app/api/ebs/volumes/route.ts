import { apiGatewayFetch } from '@/lib/aws/api-gateway'
import { withAuth } from '@/lib/auth/server'
// app/api/ebs/volumes/route.ts

async function handleGET(_request: Request) {

  const res = await apiGatewayFetch(
    `${process.env.EBS_API_URL}/volumes`,
    {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    }
  )

  const data = await res.json()

  return Response.json(data)
}
export const GET = withAuth(handleGET)
