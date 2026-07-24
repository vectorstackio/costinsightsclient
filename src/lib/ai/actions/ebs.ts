// lib/ai/actions/ebs.ts

import type {
  ActionDefinition
} from '@/types'


export const ebsActions: ActionDefinition[] = [

  //
  // Create EBS snapshot
  //

  {
    keywords: [
      'snapshot',
      'backup'
    ],

    tool:
      'createEbsSnapshot',

    resource:
      'volume',

    description:
      volumeId =>
        `Create an EBS snapshot for volume ${volumeId}`,

    confirmation:
      volumeId =>
        `This action will create an EBS snapshot.

Volume:
${volumeId}

Reply **confirm** to continue or **cancel** to abort.`
  },


  //
  // Delete EBS volume
  //

  {
    keywords: [
      'delete',
      'remove'
    ],

    tool:
      'deleteEbsVolume',

    resource:
      'volume',

    description:
      volumeId =>
        `Delete EBS volume ${volumeId}`,

    confirmation:
      volumeId =>
        `This action will delete the EBS volume.

Volume:
${volumeId}

Reply **confirm** to continue or **cancel** to abort.`
  },


  //
  // Resize EBS volume
  //

  {
    keywords: [
      'resize',
      'increase',
      'expand',
      'enlarge'
    ],

    tool:
      'resizeEbsVolume',

    resource:
      'volume',

    description:
      (
        volumeId,
        size
      ) =>
        `Resize EBS volume ${volumeId} to ${size} GiB`,

    confirmation:
      (
        volumeId,
        size
      ) =>
        `This action will increase the size of the EBS volume.

Volume:
${volumeId}

New size:
${size} GiB

EBS volume sizes cannot be reduced after increasing them.

Reply **confirm** to continue or **cancel** to abort.`
  }

]

// import type {
//   ActionDefinition
// } from '@/types'


// export const ebsActions: ActionDefinition[] = [

//   //
//   // Create EBS snapshot
//   //

//   {
//     keywords: [
//       'snapshot',
//       'backup'
//     ],

//     tool:
//       'createEbsSnapshot',

//     resource:
//       'volume',

//     description:
//       volumeId =>
//         `Create an EBS snapshot for volume ${volumeId}`,

//     confirmation:
//       volumeId =>
//         `This action will create an EBS snapshot.

// Volume:
// ${volumeId}

// Reply **confirm** to continue or **cancel** to abort.`
//   },


//   //
//   // Delete EBS volume
//   //

//   {
//     keywords: [
//       'delete',
//       'remove'
//     ],

//     tool:
//       'deleteEbsVolume',

//     resource:
//       'volume',

//     description:
//       volumeId =>
//         `Delete EBS volume ${volumeId}`,

//     confirmation:
//       volumeId =>
//         `This action will delete the EBS volume.

// Volume:
// ${volumeId}

// Reply **confirm** to continue or **cancel** to abort.`
//   }

// ]