// lib/ai/graph/index.ts

import { END, START, StateGraph } from '@langchain/langgraph'
import { Annotation } from '@langchain/langgraph'
import { ToolNode } from '@langchain/langgraph/prebuilt'
import { AIMessage } from '@langchain/core/messages'

import { agentNode } from '@/lib/ai/node/agent'
import { tools } from '@/lib/ai/tools'

const GraphState = Annotation.Root({
  question: Annotation<string>({
    reducer: (x, y) => y ?? x,
    default: () => ''
  }),

  messages: Annotation<unknown[]>({
    reducer: (x, y) => [...x, ...y],
    default: () => []
  }),

  answer: Annotation<string>({
    reducer: (x, y) => y ?? x,
    default: () => ''
  })
})

const toolNode = new ToolNode(tools)

function shouldContinue(state: typeof GraphState.State) {
  const lastMessage = state.messages[state.messages.length - 1]

  if (
    lastMessage instanceof AIMessage &&
    lastMessage.tool_calls?.length
  ) {
    return 'tools'
  }

  return END
}

export const graph = new StateGraph(GraphState)
  .addNode('agent', agentNode)
  .addNode('tools', toolNode)
  .addEdge(START, 'agent')
  .addConditionalEdges('agent', shouldContinue)
  .addEdge('tools', 'agent')
  .compile()

// import { StateGraph, START, END } from '@langchain/langgraph'
// import { ToolNode } from '@langchain/langgraph/prebuilt'
// import { AIMessage } from '@langchain/core/messages'

// import { AgentState } from '@/lib/ai/state'
// import { agentNode } from '@/lib/ai/node/agent'
// import { tools } from '@/lib/ai/tools'

// const toolNode = new ToolNode(tools)

// function shouldContinue(state: AgentState) {
//   const lastMessage = state.messages?.[state.messages.length - 1]

//   if (!lastMessage) {
//     return END
//   }

//   if (
//     lastMessage instanceof AIMessage &&
//     (lastMessage.tool_calls?.length ?? 0) > 0
//   ) {
//     return 'tools'
//   }

//   return END
// }

// // function shouldContinue(state: AgentState) {
// //   const lastMessage = state.messages?.[state.messages.length - 1]

// //   if (!lastMessage) {
// //     return END
// //   }

// //   if (
// //     lastMessage instanceof AIMessage &&
// //     lastMessage.tool_calls.length > 0
// //   ) {
// //     return 'tools'
// //   }

// //   return END
// // }

// // function shouldContinue(state: AgentState) {
// //   const lastMessage = state.messages?.[state.messages.length - 1]

// //   if (!lastMessage) {
// //     return END
// //   }

// //   if (lastMessage.tool_calls?.length) {
// //     return 'tools'
// //   }

// //   return END
// // }

// export const graph = new StateGraph<AgentState>({
//   channels: {
//     question: {
//       value: (x: string, y: string) => y ?? x,
//       default: () => ''
//     },
//     messages: {
//       value: (x, y) => [...(x ?? []), ...(y ?? [])],
//       default: () => []
//     },
//     answer: {
//       value: (x: string, y: string) => y ?? x,
//       default: () => ''
//     }
//   }
// })
//   .addNode('agent', agentNode)
//   .addNode('tools', toolNode)
//   .addEdge(START, 'agent')
//   .addConditionalEdges(
//     'agent',
//     shouldContinue
//   )
//   .addEdge('tools', 'agent')
//   .addEdge('agent', END)
//   .compile()