// app/api/costs/route.ts

export async function GET() {
  try {
    const res = await fetch(process.env.COST_API_URL!, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    })

    if (!res.ok) {
      return Response.json(
        { error: 'Failed to fetch cost data' },
        { status: res.status }
      )
    }

    const data = await res.json()

    return Response.json(data)
  } catch (err: unknown) {
    return Response.json(
      { error: (err as Error).message || 'Internal server error' },
      { status: 500 }
    )
  }
}