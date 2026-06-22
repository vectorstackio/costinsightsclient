// app/api/infrastructure/history/route.ts

export async function GET() {
  const res = await fetch(`${process.env.METRICS_HISTORY_API_URL}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json'
    }
  })

  const data = await res.json()

  return Response.json(data)
}

