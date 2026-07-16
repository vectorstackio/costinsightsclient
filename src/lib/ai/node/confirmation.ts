// lib/ai/node/confirmation.ts

import { AIMessage } from '@langchain/core/messages'

import { GraphState } from '@/lib/ai/state'

export const confirmationNode = async (
  state: typeof GraphState.State
) => {
  const action = state.pendingAction

  if (!action) {
    return {
      messages: [
        new AIMessage(
          'No action is waiting for confirmation.'
        )
      ]
    }
  }

  return {
    messages: [
      new AIMessage(
        [
          '⚠️ **Confirmation required**',
          '',
          `Action: **${action.tool}**`,
          '',
          'Arguments:',
          '```json',
          JSON.stringify(action.args, null, 2),
          '```',
          '',
          'Reply **confirm** to continue or **cancel**.'
        ].join('\n')
      )
    ]
  }
}