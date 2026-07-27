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
  // Find the best matching action.
  //
  // Longer keyword phrases receive a higher score.
  //
  // For example:
  //
  // "expand filesystem"
  //
  // scores higher than:
  //
  // "expand"
  //
  // This prevents generic keywords from
  // incorrectly winning over specific ones.
  //

  const rankedActions =
    actions
      .map(
        action => {

          const score =
            action.keywords.reduce(
              (
                total,
                keyword
              ) => {

                const normalisedKeyword =
                  keyword.toLowerCase()


                if (
                  question.includes(
                    normalisedKeyword
                  )
                ) {

                  return (
                    total +
                    normalisedKeyword.length
                  )

                }


                return total

              },
              0
            )


          return {
            action,
            score
          }

        }
      )
      .filter(
        result =>
          result.score > 0
      )
      .sort(
        (
          a,
          b
        ) =>
          b.score -
          a.score
      )


  const action =
    rankedActions[0]?.action


  //
  // No matching action found.
  //

  if (
    !action
  ) {
    return {
      messages: [
        new AIMessage(
          'I can currently create or delete EBS resources, resize EBS volumes, expand EBS filesystems, and start, stop or reboot EC2 instances.'
        )
      ]
    }
  }


  //
  // Extract resource IDs.
  //

  const volumeId =
    state.question.match(
      /vol-[a-z0-9]+/i
    )?.[0]


  const instanceId =
    state.question.match(
      /i-[a-z0-9]+/i
    )?.[0]


  //
  // Expand EBS filesystem
  // requires both a volume ID
  // and an instance ID.
  //

  if (
    action.tool === 'expandEbsFilesystem'
  ) {

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


    if (
      !instanceId
    ) {
      return {
        messages: [
          new AIMessage(
            'Please specify the EC2 instance ID.'
          )
        ]
      }
    }


    const args = {
      volumeId,

      instanceId
    }


    return {

      pendingAction: {

        tool:
          action.tool,

        args,

        description:
          action.description(
            volumeId,
            instanceId
          )

      },


      messages: [

        new AIMessage(
          action.confirmation(
            volumeId,
            instanceId
          )
        )

      ]

    }

  }


  //
  // Resource ID is required for all
  // other actions.
  //

  let resourceId:
    string | undefined


  if (
    action.resource === 'volume'
  ) {

    resourceId =
      volumeId

  }


  if (
    action.resource === 'instance'
  ) {

    resourceId =
      instanceId

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

  }


  //
  // Build arguments for standard
  // single-resource actions.
  //

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


  //
  // Create the pending action.
  //

  return {

    pendingAction: {

      tool:
        action.tool,

      args,

      description:
        action.description(
          resourceId
        )

    },


    messages: [

      new AIMessage(
        action.confirmation(
          resourceId
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
//           'I can currently create or delete EBS resources, resize EBS volumes, expand EBS filesystems, and start, stop or reboot EC2 instances.'
//         )
//       ]
//     }
//   }


//   //
//   // Extract resource IDs.
//   //

//   const volumeId =
//     state.question.match(
//       /vol-[a-z0-9]+/i
//     )?.[0]


//   const instanceId =
//     state.question.match(
//       /i-[a-z0-9]+/i
//     )?.[0]


//   //
//   // Expand EBS filesystem
//   // requires both a volume ID
//   // and an instance ID.
//   //

//   if (
//     action.tool === 'expandEbsFilesystem'
//   ) {

//     if (
//       !volumeId
//     ) {
//       return {
//         messages: [
//           new AIMessage(
//             'Please specify the EBS volume ID.'
//           )
//         ]
//       }
//     }


//     if (
//       !instanceId
//     ) {
//       return {
//         messages: [
//           new AIMessage(
//             'Please specify the EC2 instance ID.'
//           )
//         ]
//       }
//     }


//     const args = {
//       volumeId,

//       instanceId
//     }


//     return {

//       pendingAction: {

//         tool:
//           action.tool,

//         args,

//         description:
//           action.description(
//             volumeId,
//             instanceId
//           )

//       },


//       messages: [

//         new AIMessage(
//           action.confirmation(
//             volumeId,
//             instanceId
//           )
//         )

//       ]

//     }

//   }


//   //
//   // Resource ID is required for all
//   // other actions.
//   //

//   let resourceId:
//     string | undefined


//   if (
//     action.resource === 'volume'
//   ) {

//     resourceId =
//       volumeId

//   }


//   if (
//     action.resource === 'instance'
//   ) {

//     resourceId =
//       instanceId

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

//   let args:
//     Record<string, string | number>


//   if (
//     action.tool === 'resizeEbsVolume'
//   ) {

//     //
//     // Extract the requested size.
//     //
//     // Supports:
//     //
//     // 200GB
//     // 200 GB
//     // 200GiB
//     // 200 GiB
//     //

//     const sizeMatch =
//       state.question.match(
//         /(\d+)\s*(?:gb|gib)/i
//       )


//     if (
//       !sizeMatch
//     ) {
//       return {
//         messages: [
//           new AIMessage(
//             'Please specify the new EBS volume size in GB or GiB.'
//           )
//         ]
//       }
//     }


//     const size =
//       Number(
//         sizeMatch[1]
//       )


//     args = {
//       volumeId:
//         resourceId,

//       size
//     }


//     return {

//       pendingAction: {

//         tool:
//           action.tool,

//         args,

//         description:
//           action.description(
//             resourceId,
//             size
//           )

//       },


//       messages: [

//         new AIMessage(
//           action.confirmation(
//             resourceId,
//             size
//           )
//         )

//       ]

//     }

//   }


//   //
//   // Build arguments for standard
//   // single-resource actions.
//   //

//   args =
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