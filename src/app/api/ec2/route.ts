import { apiGatewayFetch } from '@/lib/aws/api-gateway'
import { withAuth } from '@/lib/auth/server'
// app/api/ec2/route.ts

async function handlePOST(req: Request) {
  const body = await req.json()

  const res = await apiGatewayFetch(`${process.env.EC2_MANAGE_INSTANCES_API_URL}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  })

  const data = await res.json()

  return Response.json(data)
}

async function handleGET(_request: Request) {
  const res = await apiGatewayFetch(`${process.env.EC2_GET_INSTANCES_API_URL}/instances`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json'
    }
  })

  const data = await res.json()

  return Response.json(data)
}
export const POST = withAuth(handlePOST)
export const GET = withAuth(handleGET)
