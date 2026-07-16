// lib/ai/node/action.ts

import {
  AIMessage
} from '@langchain/core/messages'

import {
  GraphState
} from '@/lib/ai/state'

export const actionNode = async (
  state: typeof GraphState.State
) => {
  //
  // If we already have a pending action,
  // don't create another one.
  //

  if (state.pendingAction) {
    return {
      messages: [
        new AIMessage(
          `An action is already pending.

${state.pendingAction.description}

Reply **confirm** to continue or **cancel** to abort.`
        )
      ]
    }
  }

  //
  // First time we've seen this action.
  // The classifier has already decided this is an action request.
  //

  const volumeMatch =
    state.question.match(/vol-[a-z0-9]+/i)

  const volumeId =
    volumeMatch?.[0]

  if (!volumeId) {
    return {
      messages: [
        new AIMessage(
          'Please specify the volume ID to snapshot.'
        )
      ]
    }
  }

  return {
    pendingAction: {
      tool: 'createEbsSnapshot',
      args: {
        volumeId
      },
      description:
        `Create an EBS snapshot for volume ${volumeId}`
    },

    messages: [
      new AIMessage(
        `This action will create an EBS snapshot.

Volume:
${volumeId}

Reply **confirm** to continue or **cancel** to abort.`
      )
    ]
  }

  //   return {
  //     pendingAction: {
  //       tool: 'createEbsSnapshot',
  //       args: {
  //         volumeId: 'vol-083d93921a58f1bd7'
  //       },
  //       description:
  //         'Create an EBS snapshot for volume vol-083d93921a58f1bd7'
  //     },

  //     messages: [
  //       new AIMessage(
  //         `This action will create an EBS snapshot.

  // Volume:
  // vol-083d93921a58f1bd7

  // Reply **confirm** to continue or **cancel** to abort.`
  //       )
  //     ]
  //   }
}

// import { AIMessage } from '@langchain/core/messages'

// import { GraphState } from '@/lib/ai/state'
// import {
//   createEbsSnapshot
//   // stopInstance,
//   // rebootInstance
// } from '@/lib/ai/tools'

// const actionTools = {
//   createEbsSnapshot
//   // stopInstance,
//   // rebootInstance
// }

// export const actionNode = async (
//   state: typeof GraphState.State
// ) => {
//   const question = state.question.trim().toLowerCase()

//   //
//   // User has already confirmed an action
//   //

//   if (
//     state.pendingAction &&
//     (
//       question === 'confirm' ||
//       question === 'yes'
//     )
//   ) {
//     const {
//       tool,
//       args
//     } = state.pendingAction

//     const fn = actionTools[
//       tool as keyof typeof actionTools
//     ]

//     if (!fn) {
//       return {
//         pendingAction: null,
//         messages: [
//           new AIMessage(
//             `Unknown action '${tool}'.`
//           )
//         ]
//       }
//     }

//     try {
//       const result = await fn.invoke(args as never)

//       return {
//         pendingAction: null,
//         messages: [
//           new AIMessage(
//             JSON.stringify(result, null, 2)
//           )
//         ]
//       }
//     } catch (err) {
//       return {
//         pendingAction: null,
//         messages: [
//           new AIMessage(
//             err instanceof Error
//               ? err.message
//               : 'Action failed.'
//           )
//         ]
//       }
//     }
//   }

//   //
//   // User cancelled
//   //

//   if (
//     state.pendingAction &&
//     (
//       question === 'cancel' ||
//       question === 'no'
//     )
//   ) {
//     return {
//       pendingAction: null,
//       messages: [
//         new AIMessage(
//           'Action cancelled.'
//         )
//       ]
//     }
//   }

//   //
//   // First time we've seen this action.
//   // The classifier has already decided this is an action request.
//   //

//   return {
//     pendingAction: {
//       tool: 'createEbsSnapshot',
//       args: {
//         volumeId: 'vol-083d93921a58f1bd7'
//       }
//     },

//     messages: [
//       new AIMessage(
//         `This action will create an EBS snapshot.

// Volume:
// vol-083d93921a58f1bd7

// Reply **confirm** to continue or **cancel** to abort.`
//       )
//     ]
//   }
// }