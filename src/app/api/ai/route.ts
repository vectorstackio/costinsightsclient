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

    const input = {
      question,
      messages:
        messages?.length
          ? messages
          : [new HumanMessage(question)]
    }

    const encoder = new TextEncoder()

    const stream = new ReadableStream({
      async start(controller) {
        try {
          const graphStream = await graph.stream(
            input,
            {
              streamMode: 'updates'
            }
          )

          for await (const chunk of graphStream) {
            const agentUpdate = chunk.agent

            if (!agentUpdate) continue

            const messages = agentUpdate.messages

            if (!messages?.length) continue

            const lastMessage =
              messages[messages.length - 1]

            if (
              lastMessage.content &&
              typeof lastMessage.content === 'string'
            ) {
              controller.enqueue(
                encoder.encode(lastMessage.content)
              )
            }
          }

          controller.close()

        } catch (error) {
          controller.error(error)
        }
      }
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Transfer-Encoding': 'chunked'
      }
    })

  } catch (error) {
    const errorMessage =
      error instanceof Error
        ? error.message
        : 'Failed to process AI request'

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

// import { HumanMessage } from '@langchain/core/messages'

// import { graph } from '@/lib/ai/graph'

// export async function POST(req: Request) {
//   try {
//     const { question, messages } = await req.json()

//     if (!question) {
//       return Response.json(
//         {
//           error: 'Question is required'
//         },
//         {
//           status: 400
//         }
//       )
//     }

//     const result = await graph.invoke({
//       question,
//       messages:
//         messages?.length
//           ? messages
//           : [new HumanMessage(question)]
//     })

//     return Response.json({
//       answer: result.answer
//     })
//   } catch (error) {
//     //console.error(error)
//     const errorMessage = error instanceof Error ? error.message : 'Failed to process AI request'
//     return Response.json(
//       {
//         error: errorMessage
//       },
//       {
//         status: 500
//       }
//     )
//   }
// }