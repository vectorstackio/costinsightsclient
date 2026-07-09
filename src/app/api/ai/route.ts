// app/api/ai/route.ts

import { HumanMessage } from '@langchain/core/messages'

import { graph } from '@/lib/ai/graph'

export async function POST(req: Request) {
  try {
    const { question, messages } = await req.json()

    if (!question) {
      return Response.json(
        {
          error: 'Question is required'
        },
        {
          status: 400
        }
      )
    }

    const result = await graph.invoke({
      question,
      messages:
        messages?.length
          ? messages
          : [new HumanMessage(question)]
    })

    return Response.json({
      answer: result.answer
    })
  } catch (error) {
    //console.error(error)
    const errorMessage = error instanceof Error ? error.message : 'Failed to process AI request'
    return Response.json(
      {
        error: errorMessage
      },
      {
        status: 500
      }
    )
  }
}