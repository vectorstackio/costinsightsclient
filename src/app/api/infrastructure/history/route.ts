// app/api/infrastructure/history/route.ts

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)

  const range = searchParams.get('range') ?? '24h'
  const res = await fetch(`${process.env.METRICS_HISTORY_API_URL}?range=${range}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json'
    }
  })

  const data = await res.json()

  return Response.json(data)
}

