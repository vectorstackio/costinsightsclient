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
  },

  //
  // Expand EBS filesystem
  //

  {
    keywords: [
      'expand the filesystem',
      'expand filesystem',
      'expand the file system',
      'expand file system',
      'grow the filesystem',
      'grow filesystem',
      'grow file system'
    ],

    tool:
      'expandEbsFilesystem',

    resource:
      'volume',

    description:
      (volumeId, instanceId) =>
        `Expand the filesystem for EBS volume ${volumeId} on EC2 instance ${instanceId}`,

    confirmation:
      (volumeId, instanceId) =>
        `This action will expand the partition and filesystem for the EBS volume.

Volume:
${volumeId}

EC2 instance:
${instanceId}

Reply **confirm** to continue or **cancel** to abort.`
  }

]