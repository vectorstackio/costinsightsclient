// lib/ai/node/executor.ts

import {
  AIMessage
} from '@langchain/core/messages'

import {
  GraphState
} from '@/lib/ai/state'

export const executorNode = async (
  state: typeof GraphState.State
) => {
  const pendingAction = state.pendingAction

  if (!pendingAction) {
    return {
      messages: [
        new AIMessage(
          'No pending action found.'
        )
      ]
    }
  }

  return {
    messages: [
      new AIMessage({
        content: '',
        tool_calls: [
          {
            id: crypto.randomUUID(),
            name: pendingAction.tool,
            args: pendingAction.args
          }
        ]
      })
    ]
  }
}