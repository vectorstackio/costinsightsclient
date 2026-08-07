// lib/ai/graph/index.ts

import { END, START, StateGraph } from '@langchain/langgraph'
import { AIMessage } from '@langchain/core/messages'
import { agentNode } from '@/lib/ai/node/agent'
import { toolNode } from '@/lib/ai/node/tool'
import { GraphState } from '@/lib/ai/state'
import { classifierNode } from '@/lib/ai/node/classifier'
import { actionNode } from '@/lib/ai/node/action'
import { confirmationNode } from '@/lib/ai/node/confirmation'
import { executorNode } from '@/lib/ai/node/executor'
import { cancelNode } from '@/lib/ai/node/cancel'

const shouldContinue = (
  state: typeof GraphState.State
) => {

  const lastMessage =
    state.messages[
      state.messages.length - 1
    ]

  const message =
    lastMessage as AIMessage

  if (
    message.tool_calls?.length
  ) {
    return 'tools'
  }

  return END
}


export const graph = new StateGraph(GraphState)

//
// Classify incoming request
//

  .addNode(
    'classifier',
    classifierNode
  )

//
// Normal LLM reasoning
//

  .addNode(
    'agent',
    agentNode
  )

//
// Create pending AWS action
//

  .addNode(
    'action',
    actionNode
  )

//
// Ask user for approval
//

  .addNode(
    'confirmation',
    confirmationNode
  )

//
// Execute confirmed action
//

  .addNode(
    'executor',
    executorNode
  )

//
// Handle cancelled actions
//

  .addNode(
    'cancel',
    cancelNode
  )

//
// AWS tools
//

  .addNode(
    'tools',
    toolNode
  )


//
// Start
//

  .addEdge(
    START,
    'classifier'
  )


//
// Classifier routing
//

  .addConditionalEdges(
    'classifier',
    state => state.intent,
    {
      query: 'agent',
      action: 'action',
      confirm: 'executor',
      cancel: 'cancel'
    }
  )


//
// Query tool loop
//

  .addConditionalEdges(
    'agent',
    shouldContinue
  )


  .addEdge(
    'tools',
    'agent'
  )


//
// Initial action request
//

  .addEdge(
    'action',
    'confirmation'
  )


//
// Confirmation pauses the graph.
// The next user message starts a new run.
//

  .addEdge(
    'confirmation',
    END
  )


//
// Confirmed action flow
//

  .addEdge(
    'executor',
    'tools'
  )


//
// Cancelled action flow
//

  .addEdge(
    'cancel',
    END
  )


  .compile()