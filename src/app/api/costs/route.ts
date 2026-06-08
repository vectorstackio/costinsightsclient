// app/api/costs/route.ts

export async function GET() {
  const res = await fetch(`${process.env.COST_API_URL}/summary`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json'
    }
  })

  const data = await res.json()

  return Response.json(data)
}