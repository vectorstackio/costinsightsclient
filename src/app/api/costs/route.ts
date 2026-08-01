// app/api/costs/route.ts

export async function GET() {
  try {
    const res = await fetch(`${process.env.COST_API_URL}/summary`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    })

    const data = await res.json()

    return Response.json(data)
  } catch (err) {
    return Response.json({ err }, { status: 500 })
  }
}