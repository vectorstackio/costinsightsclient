// lib/ai/node/action.ts

import {
  AIMessage
} from '@langchain/core/messages'

import {
  GraphState
} from '@/lib/ai/state'

import {
  actions
} from '@/lib/ai/actions/registry'


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


  //
  // No matching action found.
  //

  if (
    !action
  ) {
    return {
      messages: [
        new AIMessage(
          'I can currently create or delete EBS resources, resize EBS volumes, and start, stop or reboot EC2 instances.'
        )
      ]
    }
  }


  //
  // Extract the resource ID.
  //

  let resourceId:
    string | undefined


  if (
    action.resource === 'volume'
  ) {

    resourceId =
      state.question.match(
        /vol-[a-z0-9]+/i
      )?.[0]

  }


  if (
    action.resource === 'instance'
  ) {

    resourceId =
      state.question.match(
        /i-[a-z0-9]+/i
      )?.[0]

  }


  //
  // Resource ID is required.
  //

  if (
    !resourceId
  ) {
    return {
      messages: [
        new AIMessage(
          action.resource === 'volume'
            ? 'Please specify the EBS volume ID.'
            : 'Please specify the EC2 instance ID.'
        )
      ]
    }
  }


  //
  // Build the arguments for the selected tool.
  //

  let args:
    Record<string, string | number>


  if (
    action.tool === 'resizeEbsVolume'
  ) {

    //
    // Extract the requested size.
    //
    // Supports:
    //
    // 200GB
    // 200 GB
    // 200GiB
    // 200 GiB
    //

    const sizeMatch =
      state.question.match(
        /(\d+)\s*(?:gb|gib)/i
      )


    if (
      !sizeMatch
    ) {
      return {
        messages: [
          new AIMessage(
            'Please specify the new EBS volume size in GB or GiB.'
          )
        ]
      }
    }


    const size =
      Number(
        sizeMatch[1]
      )


    args = {
      volumeId:
        resourceId,

      size
    }

  } else {

    args =
      action.resource === 'volume'
        ? {
          volumeId:
            resourceId
        }
        : {
          instanceId:
            resourceId
        }

  }


  //
  // Create the pending action.
  //

  const size =
    action.tool === 'resizeEbsVolume'
      ? args.size as number
      : undefined


  return {

    pendingAction: {

      tool:
        action.tool,

      args,

      description:
        action.description(
          resourceId,
          size
        )

    },


    messages: [

      new AIMessage(
        action.confirmation(
          resourceId,
          size
        )
      )

    ]

  }

  // return {

  //   pendingAction: {

  //     tool:
  //       action.tool,

  //     args,

  //     description:
  //       action.description(
  //         resourceId
  //       )

  //   },


  //   messages: [

  //     new AIMessage(
  //       action.confirmation(
  //         resourceId
  //       )
  //     )

  //   ]

  // }

}

// import {
//   AIMessage
// } from '@langchain/core/messages'

// import {
//   GraphState
// } from '@/lib/ai/state'

// import {
//   actions
// } from '@/lib/ai/actions/registry'


// export const actionNode = async (
//   state: typeof GraphState.State
// ) => {

//   //
//   // If an action is already awaiting
//   // confirmation, don't create another.
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
//   // Find the first matching action.
//   //

//   const action =
//     actions.find(
//       action =>
//         action.keywords.some(
//           keyword =>
//             question.includes(
//               keyword
//             )
//         )
//     )


//   //
//   // No matching action found.
//   //

//   if (
//     !action
//   ) {
//     return {
//       messages: [
//         new AIMessage(
//           'I can currently create or delete EBS resources and start, stop or reboot EC2 instances.'
//         )
//       ]
//     }
//   }


//   //
//   // Extract the resource ID.
//   //

//   let resourceId:
//     string | undefined


//   if (
//     action.resource === 'volume'
//   ) {

//     resourceId =
//       state.question.match(
//         /vol-[a-z0-9]+/i
//       )?.[0]

//   }


//   if (
//     action.resource === 'instance'
//   ) {

//     resourceId =
//       state.question.match(
//         /i-[a-z0-9]+/i
//       )?.[0]

//   }


//   //
//   // Resource ID is required.
//   //

//   if (
//     !resourceId
//   ) {
//     return {
//       messages: [
//         new AIMessage(
//           action.resource === 'volume'
//             ? 'Please specify the EBS volume ID.'
//             : 'Please specify the EC2 instance ID.'
//         )
//       ]
//     }
//   }


//   //
//   // Build the arguments for the selected tool.
//   //

//   const args =
//     action.resource === 'volume'
//       ? {
//         volumeId:
//           resourceId
//       }
//       : {
//         instanceId:
//           resourceId
//       }


//   //
//   // Create the pending action.
//   //

//   return {

//     pendingAction: {

//       tool:
//         action.tool,

//       args,

//       description:
//         action.description(
//           resourceId
//         )

//     },


//     messages: [

//       new AIMessage(
//         action.confirmation(
//           resourceId
//         )
//       )

//     ]

//   }

// }


// import {
//   AIMessage
// } from '@langchain/core/messages'

// import {
//   GraphState
// } from '@/lib/ai/state'

// import type {
//   ActionDefinition
// } from '@/types'


// // type ActionDefinition = {
// //   keywords: string[]
// //   tool: string
// //   resource: 'volume' | 'instance'

// //   description: (
// //     id: string
// //   ) => string

// //   confirmation: (
// //     id: string
// //   ) => string
// // }


// const actions: ActionDefinition[] = [

//   //
//   // EBS actions
//   //

//   {
//     keywords: [
//       'snapshot',
//       'backup'
//     ],

//     tool: 'createEbsSnapshot',

//     resource: 'volume',

//     description: (
//       volumeId
//     ) =>
//       `Create an EBS snapshot for volume ${volumeId}`,

//     confirmation: (
//       volumeId
//     ) =>
//       `This action will create an EBS snapshot.

// Volume:
// ${volumeId}

// Reply **confirm** to continue or **cancel** to abort.`
//   },


//   {
//     keywords: [
//       'delete',
//       'remove'
//     ],

//     tool: 'deleteEbsVolume',

//     resource: 'volume',

//     description: (
//       volumeId
//     ) =>
//       `Delete EBS volume ${volumeId}`,

//     confirmation: (
//       volumeId
//     ) =>
//       `This action will delete the EBS volume.

// Volume:
// ${volumeId}

// Reply **confirm** to continue or **cancel** to abort.`
//   },


//   //
//   // EC2 actions
//   //

//   {
//     keywords: [
//       'start'
//     ],

//     tool: 'startEc2Instance',

//     resource: 'instance',

//     description: (
//       instanceId
//     ) =>
//       `Start EC2 instance ${instanceId}`,

//     confirmation: (
//       instanceId
//     ) =>
//       `This action will start the EC2 instance.

// Instance:
// ${instanceId}

// Reply **confirm** to continue or **cancel** to abort.`
//   },


//   {
//     keywords: [
//       'stop'
//     ],

//     tool: 'stopEc2Instance',

//     resource: 'instance',

//     description: (
//       instanceId
//     ) =>
//       `Stop EC2 instance ${instanceId}`,

//     confirmation: (
//       instanceId
//     ) =>
//       `This action will stop the EC2 instance.

// Instance:
// ${instanceId}

// Reply **confirm** to continue or **cancel** to abort.`
//   },


//   {
//     keywords: [
//       'reboot',
//       'restart'
//     ],

//     tool: 'rebootEc2Instance',

//     resource: 'instance',

//     description: (
//       instanceId
//     ) =>
//       `Reboot EC2 instance ${instanceId}`,

//     confirmation: (
//       instanceId
//     ) =>
//       `This action will reboot the EC2 instance.

// Instance:
// ${instanceId}

// Reply **confirm** to continue or **cancel** to abort.`
//   }

// ]


// export const actionNode = async (
//   state: typeof GraphState.State
// ) => {

//   //
//   // Existing pending action
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
//   // Find requested action
//   //

//   const action =
//     actions.find(
//       action =>
//         action.keywords.some(
//           keyword =>
//             question.includes(
//               keyword
//             )
//         )
//     )


//   if (
//     !action
//   ) {
//     return {
//       messages: [
//         new AIMessage(
//           'I can currently create/delete EBS resources and start, stop or reboot EC2 instances.'
//         )
//       ]
//     }
//   }


//   //
//   // Extract resource ID
//   //

//   let resourceId: string | undefined


//   if (
//     action.resource === 'volume'
//   ) {

//     resourceId =
//       state.question.match(
//         /vol-[a-z0-9]+/i
//       )?.[0]

//   }


//   if (
//     action.resource === 'instance'
//   ) {

//     resourceId =
//       state.question.match(
//         /i-[a-z0-9]+/i
//       )?.[0]

//   }


//   if (
//     !resourceId
//   ) {
//     return {
//       messages: [
//         new AIMessage(
//           action.resource === 'volume'
//             ? 'Please specify the EBS volume ID.'
//             : 'Please specify the EC2 instance ID.'
//         )
//       ]
//     }
//   }


//   return {

//     pendingAction: {

//       tool:
//         action.tool,

//       args: {
//         volumeId:
//           action.resource === 'volume'
//             ? resourceId
//             : undefined,

//         instanceId:
//           action.resource === 'instance'
//             ? resourceId
//             : undefined
//       },

//       description:
//         action.description(
//           resourceId
//         )
//     },


//     messages: [

//       new AIMessage(
//         action.confirmation(
//           resourceId
//         )
//       )

//     ]

//   }

// }