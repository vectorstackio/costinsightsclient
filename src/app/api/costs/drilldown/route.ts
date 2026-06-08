// app/api/costs/drilldown/route.ts

export async function POST(req: Request) {
  const body = await req.json()

  const res = await fetch(`${process.env.COST_API_URL}/query`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  })

  const data = await res.json()

  return Response.json(data)
}