// lib/ai/node/action.ts

import {
  AIMessage
} from '@langchain/core/messages'

import {
  GraphState
} from '@/lib/ai/state'


type ActionDefinition = {
  keywords: string[]
  tool: string
  description: (
    volumeId: string
  ) => string
  confirmation: (
    volumeId: string
  ) => string
}


const actions: ActionDefinition[] = [

  {
    keywords: [
      'snapshot',
      'backup'
    ],

    tool: 'createEbsSnapshot',

    description: (
      volumeId
    ) =>
      `Create an EBS snapshot for volume ${volumeId}`,

    confirmation: (
      volumeId
    ) =>
      `This action will create an EBS snapshot.

Volume:
${volumeId}

Reply **confirm** to continue or **cancel** to abort.`
  },

  {
    keywords: [
      'delete',
      'remove'
    ],

    tool: 'deleteEbsVolume',

    description: (
      volumeId
    ) =>
      `Delete EBS volume ${volumeId}`,

    confirmation: (
      volumeId
    ) =>
      `This action will delete the EBS volume.

Volume:
${volumeId}

Reply **confirm** to continue or **cancel** to abort.`
  }

]


export const actionNode = async (
  state: typeof GraphState.State
) => {

  //
  // If an action is already awaiting
  // confirmation, don't create another.
  //

  if (
    state.pendingAction
  ) {
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


  const question =
    state.question.toLowerCase()


  //
  // Extract the volume ID.
  //

  const volumeMatch =
    state.question.match(
      /vol-[a-z0-9]+/i
    )


  const volumeId =
    volumeMatch?.[0]


  if (
    !volumeId
  ) {
    return {
      messages: [
        new AIMessage(
          'Please specify the EBS volume ID.'
        )
      ]
    }
  }


  //
  // Find the first matching action.
  //

  const action =
    actions.find(
      action =>
        action.keywords.some(
          keyword =>
            question.includes(
              keyword
            )
        )
    )


  if (
    !action
  ) {
    return {
      messages: [
        new AIMessage(
          'I can currently create EBS snapshots or delete unused EBS volumes. Please specify which action you would like to perform.'
        )
      ]
    }
  }


  return {

    pendingAction: {

      tool:
        action.tool,

      args: {
        volumeId
      },

      description:
        action.description(
          volumeId
        )
    },

    messages: [

      new AIMessage(
        action.confirmation(
          volumeId
        )
      )

    ]
  }
}

// import {
//   AIMessage
// } from '@langchain/core/messages'

// import {
//   GraphState
// } from '@/lib/ai/state'


// export const actionNode = async (
//   state: typeof GraphState.State
// ) => {

//   //
//   // If we already have a pending action,
//   // don't create another one.
//   //

//   if (
//     state.pendingAction
//   ) {
//     return {
//       messages: [
//         new AIMessage(
//           `An action is already pending.

// ${state.pendingAction.description}

// Reply **confirm** to continue or **cancel** to abort.`
//         )
//       ]
//     }
//   }


//   const question =
//     state.question.toLowerCase()


//   //
//   // Extract EBS volume ID
//   //

//   const volumeMatch =
//     state.question.match(/vol-[a-z0-9]+/i)


//   const volumeId =
//     volumeMatch?.[0]


//   if (
//     !volumeId
//   ) {
//     return {
//       messages: [
//         new AIMessage(
//           'Please specify the EBS volume ID.'
//         )
//       ]
//     }
//   }


//   //
//   // Determine requested action
//   //

//   let tool: string
//   let description: string
//   let confirmationMessage: string


//   if (
//     question.includes('delete') ||
//     question.includes('remove')
//   ) {

//     tool = 'deleteEbsVolume'

//     description =
//       `Delete EBS volume ${volumeId}`

//     confirmationMessage =
//       `This action will delete the EBS volume.

// Volume:
// ${volumeId}

// Reply **confirm** to continue or **cancel** to abort.`

//   } else if (
//     question.includes('snapshot') ||
//     question.includes('backup')
//   ) {

//     tool = 'createEbsSnapshot'

//     description =
//       `Create an EBS snapshot for volume ${volumeId}`

//     confirmationMessage =
//       `This action will create an EBS snapshot.

// Volume:
// ${volumeId}

// Reply **confirm** to continue or **cancel** to abort.`

//   } else {

//     return {
//       messages: [
//         new AIMessage(
//           'I can currently create EBS snapshots or delete unused EBS volumes. Please specify which action you would like to perform.'
//         )
//       ]
//     }

//   }


//   return {
//     pendingAction: {
//       tool,
//       args: {
//         volumeId
//       },
//       description
//     },

//     messages: [
//       new AIMessage(
//         confirmationMessage
//       )
//     ]
//   }
// }