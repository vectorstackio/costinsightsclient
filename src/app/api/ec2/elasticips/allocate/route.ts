// app/api/ec2/elasticips/allocate/route.ts

export async function POST(req: Request) {
  const body = await req.json()

  const res = await fetch(`${process.env.EC2_ALLOCATE_ELASTIC_IP_API_URL}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  })

  const data = await res.json()

  return Response.json(data)
}