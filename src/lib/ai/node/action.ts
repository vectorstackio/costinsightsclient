// lib/ai/node/action.ts

import { AIMessage } from '@langchain/core/messages'

import { GraphState } from '@/lib/ai/state'
import {
  createEbsSnapshot
  // stopInstance,
  // rebootInstance
} from '@/lib/ai/tools'

const actionTools = {
  createEbsSnapshot
  // stopInstance,
  // rebootInstance
}

export const actionNode = async (
  state: typeof GraphState.State
) => {
  const question = state.question.trim().toLowerCase()

  //
  // User has already confirmed an action
  //

  if (
    state.pendingAction &&
    (
      question === 'confirm' ||
      question === 'yes'
    )
  ) {
    const {
      tool,
      args
    } = state.pendingAction

    const fn = actionTools[
      tool as keyof typeof actionTools
    ]

    if (!fn) {
      return {
        pendingAction: null,
        messages: [
          new AIMessage(
            `Unknown action '${tool}'.`
          )
        ]
      }
    }

    try {
      const result = await fn.invoke(args as never)

      return {
        pendingAction: null,
        messages: [
          new AIMessage(
            JSON.stringify(result, null, 2)
          )
        ]
      }
    } catch (err) {
      return {
        pendingAction: null,
        messages: [
          new AIMessage(
            err instanceof Error
              ? err.message
              : 'Action failed.'
          )
        ]
      }
    }
  }

  //
  // User cancelled
  //

  if (
    state.pendingAction &&
    (
      question === 'cancel' ||
      question === 'no'
    )
  ) {
    return {
      pendingAction: null,
      messages: [
        new AIMessage(
          'Action cancelled.'
        )
      ]
    }
  }

  //
  // First time we've seen this action.
  // The classifier has already decided this is an action request.
  //

  return {
    pendingAction: {
      tool: 'createSnapshot',
      args: {
        volumeId: 'vol-083d93921a58f1bd7'
      }
    },

    messages: [
      new AIMessage(
        `This action will create an EBS snapshot.

Volume:
vol-083d93921a58f1bd7

Reply **confirm** to continue or **cancel** to abort.`
      )
    ]
  }
}

// import { AIMessage } from '@langchain/core/messages'

// //import { GraphState } from '@/lib/ai/state'


// export const actionNode = async (/*state: typeof GraphState.State*/) => {

//   //console.log('Action requested:', state.question)

//   return {
//     messages: [
//       new AIMessage(
//         'This action requires confirmation before it can be executed.'
//       )
//     ]
//   }
// }