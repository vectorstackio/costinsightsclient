// app/api/ec2/idle/route.ts

export async function GET() {
  const res = await fetch(`${process.env.EC2_GET_INSTANCES_API_URL}/idle`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json'
    }
  })

  const data = await res.json()

  return Response.json(data)
}