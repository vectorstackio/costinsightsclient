// lib/ai/graph/index.ts

import { END, START, StateGraph } from '@langchain/langgraph'
import { Annotation, messagesStateReducer } from '@langchain/langgraph'
import { AIMessage, BaseMessage } from '@langchain/core/messages'

import { agentNode } from '@/lib/ai/node/agent'
import { toolNode } from '@/lib/ai/node/tool'

const GraphState = Annotation.Root({
  question: Annotation<string>({
    reducer: (x, y) => y ?? x,
    default: () => ''
  }),

  messages: Annotation<BaseMessage[]>({
    reducer: messagesStateReducer,
    default: () => []
  })
})

const shouldContinue = (state: typeof GraphState.State) => {
  const lastMessage = state.messages[state.messages.length - 1]
  const message = lastMessage as AIMessage

  if (message.tool_calls?.length) {
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