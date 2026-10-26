import { withAuth } from '@/lib/auth/server'
// app/api/ec2/elasticips/associate/route.ts

async function handlePOST(req: Request) {
  const body = await req.json()

  const res = await fetch(`${process.env.EC2_ASSOCIATE_ELASTIC_IP_API_URL}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  })

  const data = await res.json()

  return Response.json(data)
}
export const POST = withAuth(handlePOST)
