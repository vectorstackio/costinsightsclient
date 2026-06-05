// app/api/costs/drilldown/route.ts

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const service = searchParams.get('service')

  if (!service) {
    return Response.json({ error: 'Missing service' }, { status: 400 })
  }

  const res = await fetch(
    //`${process.env.COST_API_URL}/drilldown?service=${encodeURIComponent(service)}`
    `${process.env.COST_API_URL}?service=${encodeURIComponent(service)}`
  )

  const data = await res.json()

  return Response.json(data)
}