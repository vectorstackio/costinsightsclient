import { withAuth } from '@/lib/auth/server'
// app/api/ec2/idle/route.ts

async function handleGET(_request: Request) {
  const res = await fetch(`${process.env.EC2_GET_INSTANCES_API_URL}/idle`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json'
    }
  })

  const data = await res.json()

  return Response.json(data)
}
export const GET = withAuth(handleGET)
