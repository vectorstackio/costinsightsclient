// lib/ai/graph/index.ts

import { END, START, StateGraph } from '@langchain/langgraph'
import { AIMessage/*, BaseMessage */ } from '@langchain/core/messages'

import { agentNode } from '@/lib/ai/node/agent'
import { toolNode } from '@/lib/ai/node/tool'
import { GraphState } from '@/lib/ai/state'
import { classifierNode } from '@/lib/ai/node/classifier'
import { actionNode } from '@/lib/ai/node/action'
import { confirmationNode } from '@/lib/ai/node/confirmation'

const shouldContinue = (state: typeof GraphState.State) => {
  const lastMessage = state.messages[state.messages.length - 1]
  const message = lastMessage as AIMessage

  if (message.tool_calls?.length) {
    return 'tools'
  }

  return END
}

export const graph = new StateGraph(GraphState)

  // Decide whether this is a query or an action
  .addNode(
    'classifier',
    classifierNode
  )

  // Normal LLM reasoning
  .addNode(
    'agent',
    agentNode
  )

  // Determine which action should be performed
  .addNode(
    'action',
    actionNode
  )

  // Ask the user to confirm the action
  .addNode(
    'confirmation',
    confirmationNode
  )

  // Read-only AWS tools
  .addNode(
    'tools',
    toolNode
  )

  // Start
  .addEdge(
    START,
    'classifier'
  )

  // Route based on intent
  .addConditionalEdges(
    'classifier',
    state => state.intent,
    {
      query: 'agent',
      action: 'action'
    }
  )

  // Normal tool loop
  .addConditionalEdges(
    'agent',
    shouldContinue
  )

  .addEdge(
    'tools',
    'agent'
  )

  // Action flow
  .addEdge(
    'action',
    'confirmation'
  )

  .addEdge(
    'confirmation',
    END
  )

  .compile()

// export const graph = new StateGraph(GraphState)

//   // classify the request first
//   .addNode(
//     'classifier',
//     classifierNode
//   )

//   // normal AI reasoning node
//   .addNode(
//     'agent',
//     agentNode
//   )

//   // action handling node
//   .addNode(
//     'action',
//     actionNode
//   )

//   // existing tools
//   .addNode(
//     'tools',
//     toolNode
//   )


//   .addEdge(
//     START,
//     'classifier'
//   )


//   .addConditionalEdges(
//     'classifier',
//     state => state.intent,
//     {
//       query: 'agent',
//       action: 'action'
//     }
//   )


//   .addConditionalEdges(
//     'agent',
//     shouldContinue
//   )


//   .addEdge(
//     'tools',
//     'agent'
//   )


//   .addEdge(
//     'action',
//     END
//   )


//   .compile()

// export const graph = new StateGraph(GraphState)
//   .addNode('agent', agentNode)
//   .addNode('tools', toolNode)
//   .addEdge(START, 'agent')
//   .addConditionalEdges('agent', shouldContinue)
//   .addEdge('tools', 'agent')
//   .compile()