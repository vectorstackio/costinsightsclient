// app/api/lambda/route.ts

export async function GET() {
  const res = await fetch(`${process.env.LAMBDA_GET_FUNCTIONS_API_URL}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json'
    }
  })

  const data = await res.json()

  return Response.json(data)
}