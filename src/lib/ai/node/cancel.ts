// lib/ai/node/cancel.ts

import {
  AIMessage
} from '@langchain/core/messages'

export const cancelNode = async () => {
  return {
    pendingAction: null,
    messages: [
      new AIMessage(
        'Action cancelled.'
      )
    ]
  }
}