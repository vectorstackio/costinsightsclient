// app/api/ai/route.ts

import {
  AIMessage,
  HumanMessage
} from '@langchain/core/messages'

import { graph } from '@/lib/ai/graph'
import { model } from '@/lib/ai/llm'

type ClientMessage = {
  role: 'user' | 'assistant'
  content: string
}

export async function POST(req: Request) {

  const {
    //conversationId,
    question,
    messages
  } = await req.json()

  const history = (messages ?? []).map(
    (message: ClientMessage) =>
      message.role === 'user'
        ? new HumanMessage(message.content)
        : new AIMessage(message.content)
  )

  const result = await graph.invoke({
    question,
    messages: history
  })

  const encoder = new TextEncoder()

  const stream = new ReadableStream({

    async start(controller) {

      const responseStream = await model.stream(
        result.messages
      )

      for await (const chunk of responseStream) {

        if (chunk.content) {

          controller.enqueue(
            encoder.encode(
              chunk.content.toString()
            )
          )

        }

      }

      controller.close()

    }

  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-cache'
    }
  })

}

// import { HumanMessage } from '@langchain/core/messages'

// import { graph } from '@/lib/ai/graph'
// import { model } from '@/lib/ai/llm'


// export async function POST(req: Request) {

//   const {
//     question,
//     messages
//   } = await req.json()


//   const result = await graph.invoke({
//     question,
//     messages:
//       messages?.length
//         ? messages
//         : [
//           new HumanMessage(question)
//         ]
//   })


//   const encoder = new TextEncoder()


//   const stream = new ReadableStream({

//     async start(controller) {

//       const responseStream = await model.stream(
//         result.messages
//       )


//       for await (const chunk of responseStream) {

//         if (chunk.content) {

//           controller.enqueue(
//             encoder.encode(
//               chunk.content.toString()
//             )
//           )

//         }
//       }


//       controller.close()
//     }

//   })


//   return new Response(stream, {

//     headers: {
//       'Content-Type': 'text/plain; charset=utf-8',
//       'Cache-Control': 'no-cache'
//     }

//   })
// }