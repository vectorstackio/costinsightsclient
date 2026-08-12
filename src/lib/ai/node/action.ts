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
          'I can currently create or delete EBS resources, resize EBS volumes, expand EBS filesystems, manage Elastic IPs, and start, stop or reboot EC2 instances.'
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


  const allocationId =
    state.question.match(
      /eipalloc-[a-z0-9]+/i
    )?.[0]


  const publicIp =
    state.question.match(
      /\b(?:\d{1,3}\.){3}\d{1,3}\b/
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
  // Assign Elastic IP
  //
  // Requires an EC2 instance ID.
  //
  // The assignElasticIp tool will:
  //
  // 1. Check whether the instance already has an EIP.
  // 2. Use a spare EIP if one exists.
  // 3. Otherwise allocate a new EIP.
  // 4. Associate the EIP with the instance.
  //

  if (
    action.tool === 'assignElasticIp'
  ) {

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


    //
    // Get the current Elastic IP inventory.
    //

    const res =
      await fetch(
        `${process.env.NEXT_PUBLIC_BASE_URL}/api/ec2/elasticips`
      )


    if (
      !res.ok
    ) {
      return {
        messages: [
          new AIMessage(
            'I was unable to retrieve the Elastic IP information.'
          )
        ]
      }
    }


    const data =
      await res.json()


    //
    // Check whether the target instance
    // already has an Elastic IP.
    //

    const existingInstanceIp =
      data.elasticIps?.find(
        (ip: {
          associated: boolean
          instanceId?: string
          publicIp?: string
        }) =>
          ip.associated === true &&
          ip.instanceId === instanceId
      )


    if (
      existingInstanceIp
    ) {
      return {
        messages: [
          new AIMessage(
            `EC2 instance ${instanceId} already has Elastic IP ${existingInstanceIp.publicIp} associated with it. No changes were made.`
          )
        ]
      }
    }


    //
    // The instance does not currently have
    // an Elastic IP, so create the pending action.
    //

    const args = {
      instanceId
    }


    return {

      pendingAction: {

        tool:
          action.tool,

        args,

        description:
          action.description(
            instanceId
          )

      },


      messages: [

        new AIMessage(
          action.confirmation(
            instanceId
          )
        )

      ]

    }

  }

  // if (
  //   action.tool === 'assignElasticIp'
  // ) {

  //   if (
  //     !instanceId
  //   ) {
  //     return {
  //       messages: [
  //         new AIMessage(
  //           'Please specify the EC2 instance ID.'
  //         )
  //       ]
  //     }
  //   }


  //   const args = {
  //     instanceId
  //   }


  //   return {

  //     pendingAction: {

  //       tool:
  //         action.tool,

  //       args,

  //       description:
  //         action.description(
  //           instanceId
  //         )

  //     },


  //     messages: [

  //       new AIMessage(
  //         action.confirmation(
  //           instanceId
  //         )
  //       )

  //     ]

  //   }

  // }


  //
  // Associate Elastic IP
  //
  // Requires an allocation ID or public IP,
  // plus an instance ID.
  //

  if (
    action.tool === 'associateElasticIp'
  ) {

    if (
      !allocationId &&
      !publicIp
    ) {
      return {
        messages: [
          new AIMessage(
            'Please specify the Elastic IP allocation ID or public IP address.'
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


    //
    // Get the current Elastic IP inventory.
    //

    const res =
      await fetch(
        `${process.env.NEXT_PUBLIC_BASE_URL}/api/ec2/elasticips`
      )


    if (
      !res.ok
    ) {
      return {
        messages: [
          new AIMessage(
            'I was unable to retrieve the Elastic IP information.'
          )
        ]
      }
    }


    const data =
      await res.json()


    //
    // Find the requested Elastic IP.
    //

    const elasticIp =
      data.elasticIps?.find(
        (ip: {
          publicIp: string
          allocationId: string
          associated: boolean
          instanceId?: string
        }) =>
          allocationId
            ? ip.allocationId === allocationId
            : ip.publicIp === publicIp
      )


    if (
      !elasticIp
    ) {
      return {
        messages: [
          new AIMessage(
            `I could not find Elastic IP ${publicIp ?? allocationId} in your AWS account.`
          )
        ]
      }
    }


    //
    // Check whether the requested Elastic IP
    // is already associated with an instance.
    //

    if (
      elasticIp.associated
    ) {
      return {
        messages: [
          new AIMessage(
            `Elastic IP ${elasticIp.publicIp} is already associated with EC2 instance ${elasticIp.instanceId ?? 'another resource'}. I will not reassign it.`
          )
        ]
      }
    }


    //
    // Check whether the target instance already
    // has an Elastic IP.
    //

    const instanceElasticIp =
      data.elasticIps?.find(
        (ip: {
          publicIp: string
          allocationId: string
          associated: boolean
          instanceId?: string
        }) =>
          ip.associated === true &&
          ip.instanceId === instanceId
      )


    if (
      instanceElasticIp
    ) {
      return {
        messages: [
          new AIMessage(
            `EC2 instance ${instanceId} already has Elastic IP ${instanceElasticIp.publicIp} associated with it. I will not replace the existing Elastic IP.`
          )
        ]
      }
    }


    //
    // Create the pending action.
    //

    const args = {
      allocationId:
        elasticIp.allocationId,

      instanceId
    }


    return {

      pendingAction: {

        tool:
          action.tool,

        args,

        description:
          action.description(
            elasticIp.publicIp,
            instanceId
          )

      },


      messages: [

        new AIMessage(
          action.confirmation(
            elasticIp.publicIp,
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


  if (
    action.resource === 'elasticIp'
  ) {

    resourceId =
      allocationId

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
            : action.resource === 'instance'
              ? 'Please specify the EC2 instance ID.'
              : 'Please specify the Elastic IP allocation ID.'
        )
      ]
    }
  }


  //
  // Build arguments for the resize EBS action.
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

  if (
    action.resource === 'volume'
  ) {

    args = {
      volumeId:
        resourceId
    }

  } else if (
    action.resource === 'instance'
  ) {

    args = {
      instanceId:
        resourceId
    }

  } else {

    args = {
      allocationId:
        resourceId
    }

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
//   // Find the best matching action.
//   //
//   // Longer keyword phrases receive a higher score.
//   //
//   // For example:
//   //
//   // "expand filesystem"
//   //
//   // scores higher than:
//   //
//   // "expand"
//   //
//   // This prevents generic keywords from
//   // incorrectly winning over specific ones.
//   //

//   const rankedActions =
//     actions
//       .map(
//         action => {

//           const score =
//             action.keywords.reduce(
//               (
//                 total,
//                 keyword
//               ) => {

//                 const normalisedKeyword =
//                   keyword.toLowerCase()


//                 if (
//                   question.includes(
//                     normalisedKeyword
//                   )
//                 ) {

//                   return (
//                     total +
//                     normalisedKeyword.length
//                   )

//                 }


//                 return total

//               },
//               0
//             )


//           return {
//             action,
//             score
//           }

//         }
//       )
//       .filter(
//         result =>
//           result.score > 0
//       )
//       .sort(
//         (
//           a,
//           b
//         ) =>
//           b.score -
//           a.score
//       )


//   const action =
//     rankedActions[0]?.action


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


//   const allocationId =
//     state.question.match(
//       /eipalloc-[a-z0-9]+/i
//     )?.[0]

//   const publicIp =
//     state.question.match(
//       /\b(?:\d{1,3}\.){3}\d{1,3}\b/
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
//   // Associate Elastic IP
//   // requires an allocation ID or public IP,
//   // plus an instance ID.
//   //

//   if (
//     action.tool === 'associateElasticIp'
//   ) {

//     if (
//       !allocationId &&
//       !publicIp
//     ) {
//       return {
//         messages: [
//           new AIMessage(
//             'Please specify the Elastic IP allocation ID or public IP address.'
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


//     //
//     // Get the current Elastic IP inventory.
//     //

//     const res =
//       await fetch(
//         `${process.env.NEXT_PUBLIC_BASE_URL}/api/ec2/elasticips`
//       )


//     if (
//       !res.ok
//     ) {
//       return {
//         messages: [
//           new AIMessage(
//             'I was unable to retrieve the Elastic IP information.'
//           )
//         ]
//       }
//     }


//     const data =
//       await res.json()


//     //
//     // Find the requested Elastic IP.
//     //

//     const elasticIp =
//       data.elasticIps?.find(
//         (ip: {
//           publicIp: string
//           allocationId: string
//           associated: boolean
//           instanceId?: string
//         }) =>
//           allocationId
//             ? ip.allocationId === allocationId
//             : ip.publicIp === publicIp
//       )

//     // const elasticIp =
//     //   data.elasticIps?.find(
//     //     (ip: {
//     //       publicIp: string
//     //       allocationId: string
//     //       associated: boolean
//     //       associatedInstanceId?: string
//     //     }) =>
//     //       allocationId
//     //         ? ip.allocationId === allocationId
//     //         : ip.publicIp === publicIp
//     //   )


//     if (
//       !elasticIp
//     ) {
//       return {
//         messages: [
//           new AIMessage(
//             `I could not find Elastic IP ${publicIp ?? allocationId} in your AWS account.`
//           )
//         ]
//       }
//     }


//     //
//     // Check whether the requested Elastic IP
//     // is already associated with an instance.
//     //

//     if (
//       elasticIp.associated
//     ) {
//       return {
//         messages: [
//           new AIMessage(
//             `Elastic IP ${elasticIp.publicIp} is already associated with EC2 instance ${elasticIp.instanceId ?? 'another resource'}. I will not reassign it.`
//           )
//         ]
//       }
//     }


//     //
//     // Check whether the target instance already
//     // has an Elastic IP.
//     //

//     // const instanceElasticIp =
//     //   data.elasticIps?.find(
//     //     (ip: {
//     //       publicIp: string
//     //       allocationId: string
//     //       associated: boolean
//     //       associatedInstanceId?: string
//     //     }) =>
//     //       ip.associatedInstanceId === instanceId
//     //   )

//     const instanceElasticIp =
//       data.elasticIps?.find(
//         (ip: {
//           publicIp: string
//           allocationId: string
//           associated: boolean
//           instanceId?: string
//         }) =>
//           ip.associated === true &&
//           ip.instanceId === instanceId
//       )


//     if (
//       instanceElasticIp
//     ) {
//       return {
//         messages: [
//           new AIMessage(
//             `EC2 instance ${instanceId} already has Elastic IP ${instanceElasticIp.publicIp} associated with it. I will not replace the existing Elastic IP. `
//           )
//         ]
//       }
//     }


//     //
//     // Create the pending action.
//     //

//     const args = {
//       allocationId:
//         elasticIp.allocationId,

//       instanceId
//     }


//     return {

//       pendingAction: {

//         tool:
//           action.tool,

//         args,

//         description:
//           action.description(
//             elasticIp.publicIp,
//             instanceId
//           )

//       },


//       messages: [

//         new AIMessage(
//           action.confirmation(
//             elasticIp.publicIp,
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

//   if (
//     action.resource === 'elasticIp'
//   ) {

//     resourceId =
//       allocationId

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
//             : action.resource === 'instance'
//               ? 'Please specify the EC2 instance ID.'
//               : 'Please specify the Elastic IP allocation ID.'
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

//   if (
//     action.resource === 'volume'
//   ) {

//     args = {
//       volumeId:
//         resourceId
//     }

//   } else if (
//     action.resource === 'instance'
//   ) {

//     args = {
//       instanceId:
//         resourceId
//     }

//   } else {

//     args = {
//       allocationId:
//         resourceId
//     }

//   }


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