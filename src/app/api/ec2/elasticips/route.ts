// app/api/ec2/elasticips/route.ts

export async function GET() {

  const res = await fetch(
    `${process.env.EC2_GET_ELASTIC_IPS_API_URL}`,
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