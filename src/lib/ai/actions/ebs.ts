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
  }

]