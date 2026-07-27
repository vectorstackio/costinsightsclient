// app/api/ebs/expand/route.ts

export async function POST(req: Request) {
  const body = await req.json()

  const res = await fetch(`${process.env.EBS_EXPAND_API_URL}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  })

  const data = await res.json()

  return Response.json(data)
}