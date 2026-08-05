// app/api/ec2/route.ts

export async function POST(req: Request) {
  const body = await req.json()

  const res = await fetch(`${process.env.EC2_MANAGE_INSTANCES_API_URL}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  })

  const data = await res.json()

  return Response.json(data)
}

export async function GET() {
  const res = await fetch(`${process.env.EC2_GET_INSTANCES_API_URL}/instances`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json'
    }
  })

  const data = await res.json()

  return Response.json(data)
}