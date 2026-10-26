import { withAuth } from '@/lib/auth/server'
// app/api/conversations/title/route.ts

import { HumanMessage, SystemMessage } from '@langchain/core/messages'

import { model } from '@/lib/ai/llm'

async function handlePOST(req: Request) {

  const { question } = await req.json()

  const response = await model.invoke([
    new SystemMessage(`
Generate a short conversation title.

Rules:

- Maximum 6 words.
- Title Case.
- No quotes.
- No punctuation at the end.
- Return only the title.
`),
    new HumanMessage(question)
  ])

  return Response.json({
    title:
      typeof response.content === 'string'
        ? response.content.trim()
        : ''
  })

}


export const POST = withAuth(handlePOST)
