// app/api/ai/route.ts

import {
  AIMessage,
  HumanMessage
} from '@langchain/core/messages'

import {
  graph
} from '@/lib/ai/graph'

import {
  getPendingAction,
  setPendingAction
} from '@/lib/ai/pendingActionStore'

import type {
  AgentEvent
} from '@/types'

import type {
  PendingAction
} from '@/types'


type ClientMessage = {
  role: 'user' | 'assistant'
  content: string
}


export async function POST(
  req: Request
) {
  const {
    question,
    messages
  } = await req.json()


  const history = (messages ?? []).map(
    (message: ClientMessage) =>
      message.role === 'user'
        ? new HumanMessage(message.content)
        : new AIMessage(message.content)
  )


  const eventStream =
    graph.streamEvents(
      {
        question,
        messages: history,
        pendingAction: getPendingAction()
      },
      {
        version: 'v2'
      }
    )


  const encoder =
    new TextEncoder()


  const stream =
    new ReadableStream({

      async start(controller) {

        //let finalState: unknown = null
        let finalState: {
          pendingAction?: PendingAction | null
        } | null = null


        const sendEvent = (
          event: AgentEvent
        ) => {
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify(event)}\n\n`
            )
          )
        }


        sendEvent({
          type: 'status',
          message: 'Analysing request...'
        })


        for await (
          const event of eventStream
        ) {

          /*
           * Capture final graph state
           */
          if (
            event.event === 'on_chain_end'
          ) {
            finalState =
              event.data.output
          }


          /*
           * Tool started
           */
          if (
            event.event === 'on_tool_start'
          ) {
            sendEvent({
              type: 'tool_start',
              tool: event.name
            })
          }


          /*
           * Tool completed
           */
          if (
            event.event === 'on_tool_end'
          ) {
            sendEvent({
              type: 'tool_end',
              tool: event.name
            })
          }


          /*
           * Normal LLM token streaming
           *
           * Used by agentNode responses
           */
          if (
            event.event === 'on_chat_model_stream'
          ) {
            const chunk =
              event.data.chunk


            if (
              chunk.content
            ) {
              sendEvent({
                type: 'answer',
                content:
                  chunk.content.toString()
              })
            }
          }


          /*
           * Direct LangGraph node messages
           *
           * Used by nodes like:
           * - confirmationNode
           * - cancelNode
           */
          if (
            event.event === 'on_chain_stream'
          ) {

            const chunk =
              event.data.chunk


            const nodeOutput =
              Object.values(chunk)[0] as {
                messages?: AIMessage[]
              } | undefined


            const messages =
              nodeOutput?.messages


            const lastMessage =
              messages?.[
                messages.length - 1
              ]


            if (
              lastMessage instanceof AIMessage &&
              lastMessage.content
            ) {
              sendEvent({
                type: 'answer',
                content:
                  lastMessage.content.toString()
              })
            }
          }

        }


        /*
         * Persist pending action
         *
         * This allows the next request
         * ("confirm" / "cancel") to know
         * what action is being discussed.
         */
        if (
          finalState
        ) {
          setPendingAction(
            finalState.pendingAction ?? null
          )
        }


        controller.close()
      }
    })


  return new Response(
    stream,
    {
      headers: {
        'Content-Type':
          'text/event-stream',

        'Cache-Control':
          'no-cache',

        Connection:
          'keep-alive'
      }
    }
  )
}

// import {
//   AIMessage,
//   HumanMessage
// } from '@langchain/core/messages'

// import {
//   graph
// } from '@/lib/ai/graph'

// import type {
//   AgentEvent
// } from '@/types'


// type ClientMessage = {
//   role: 'user' | 'assistant'
//   content: string
// }


// export async function POST(
//   req: Request
// ) {
//   const {
//     question,
//     messages
//   } = await req.json()


//   const history = (messages ?? []).map(
//     (message: ClientMessage) =>
//       message.role === 'user'
//         ? new HumanMessage(message.content)
//         : new AIMessage(message.content)
//   )


//   const eventStream =
//     graph.streamEvents(
//       {
//         question,
//         messages: history
//       },
//       {
//         version: 'v2'
//       }
//     )


//   const encoder =
//     new TextEncoder()


//   const stream =
//     new ReadableStream({

//       async start(controller) {

//         const sendEvent = (
//           event: AgentEvent
//         ) => {
//           controller.enqueue(
//             encoder.encode(
//               `data: ${JSON.stringify(event)}\n\n`
//             )
//           )
//         }


//         sendEvent({
//           type: 'status',
//           message: 'Analysing request...'
//         })


//         for await (
//           const event of eventStream
//         ) {

//           /*
//            * Tool started
//            */
//           if (
//             event.event === 'on_tool_start'
//           ) {
//             sendEvent({
//               type: 'tool_start',
//               tool: event.name
//             })
//           }


//           /*
//            * Tool completed
//            */
//           if (
//             event.event === 'on_tool_end'
//           ) {
//             sendEvent({
//               type: 'tool_end',
//               tool: event.name
//             })
//           }


//           /*
//            * Normal LLM token streaming
//            *
//            * Used by agentNode responses
//            */
//           if (
//             event.event === 'on_chat_model_stream'
//           ) {
//             const chunk =
//               event.data.chunk

//             if (
//               chunk.content
//             ) {
//               sendEvent({
//                 type: 'answer',
//                 content:
//                   chunk.content.toString()
//               })
//             }
//           }


//           /*
//            * Direct LangGraph node messages
//            *
//            * Used by nodes like:
//            * - confirmationNode
//            * - cancelNode
//            */
//           if (
//             event.event === 'on_chain_stream'
//           ) {

//             const chunk =
//               event.data.chunk

//             const nodeOutput =
//               Object.values(chunk)[0] as {
//                 messages?: AIMessage[]
//               } | undefined


//             const messages =
//               nodeOutput?.messages


//             const lastMessage =
//               messages?.[
//                 messages.length - 1
//               ]


//             if (
//               lastMessage instanceof AIMessage &&
//               lastMessage.content
//             ) {
//               sendEvent({
//                 type: 'answer',
//                 content:
//                   lastMessage.content.toString()
//               })
//             }
//           }

//         }


//         controller.close()
//       }
//     })


//   return new Response(
//     stream,
//     {
//       headers: {
//         'Content-Type':
//           'text/event-stream',
//         'Cache-Control':
//           'no-cache',
//         Connection:
//           'keep-alive'
//       }
//     }
//   )
// }

// import {
//   AIMessage,
//   HumanMessage
// } from '@langchain/core/messages'

// import { graph } from '@/lib/ai/graph'

// import type { AgentEvent } from '@/types'

// type ClientMessage = {
//   role: 'user' | 'assistant'
//   content: string
// }

// export async function POST(req: Request) {
//   const {
//     question,
//     messages
//   } = await req.json()

//   const history = (messages ?? []).map(
//     (message: ClientMessage) =>
//       message.role === 'user'
//         ? new HumanMessage(message.content)
//         : new AIMessage(message.content)
//   )

//   const eventStream = graph.streamEvents(
//     {
//       question,
//       messages: history
//     },
//     {
//       version: 'v2'
//     }
//   )

//   const encoder = new TextEncoder()
//   const stream = new ReadableStream({
//     async start(controller) {
//       const sendEvent = (event: AgentEvent) => {
//         controller.enqueue(
//           encoder.encode(
//             `data: ${JSON.stringify(event)}\n\n`
//           )
//         )

//       }

//       sendEvent({
//         type: 'status',
//         message: 'Analysing request...'
//       })

//       for await (const event of eventStream) {
//         console.log(
//           'EVENT:',
//           event.event,
//           event.name
//         )

//         /*
//          * Tool started
//          */
//         if (event.event === 'on_tool_start') {
//           sendEvent({
//             type: 'tool_start',
//             tool: event.name
//           })

//         }

//         /*
//          * Tool completed
//          */
//         if (event.event === 'on_tool_end') {
//           sendEvent({
//             type: 'tool_end',
//             tool: event.name
//           })

//         }

//         /*
//          * Final LLM response chunks
//          */
//         if (event.event === 'on_chat_model_stream') {
//           const chunk = event.data.chunk
//           if (chunk.content) {
//             sendEvent({
//               type: 'answer',
//               content: chunk.content.toString()
//             })
//           }
//         }

//       }

//       controller.close()
//     }
//   })

//   return new Response(stream, {
//     headers: {
//       'Content-Type': 'text/event-stream',
//       'Cache-Control': 'no-cache',
//       Connection: 'keep-alive'
//     }
//   })
// }