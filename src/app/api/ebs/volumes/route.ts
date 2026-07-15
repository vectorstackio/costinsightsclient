// app/api/ebs/volumes/route.ts

export async function GET() {

  const res = await fetch(
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