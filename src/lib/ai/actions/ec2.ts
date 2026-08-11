// lib/ai/actions/ec2.ts

import type {
  ActionDefinition
} from '@/types'


export const ec2Actions: ActionDefinition[] = [

  //
  // Start EC2 instance
  //

  {
    keywords: [
      'start'
    ],

    tool:
      'startEc2Instance',

    resource:
      'instance',

    description:
      instanceId =>
        `Start EC2 instance ${instanceId}`,

    confirmation:
      instanceId =>
        `This action will start the EC2 instance.

Instance:
${instanceId}

Reply **confirm** to continue or **cancel** to abort.`
  },


  //
  // Stop EC2 instance
  //

  {
    keywords: [
      'stop'
    ],

    tool:
      'stopEc2Instance',

    resource:
      'instance',

    description:
      instanceId =>
        `Stop EC2 instance ${instanceId}`,

    confirmation:
      instanceId =>
        `This action will stop the EC2 instance.

Instance:
${instanceId}

Reply **confirm** to continue or **cancel** to abort.`
  },


  //
  // Reboot EC2 instance
  //

  {
    keywords: [
      'reboot',
      'restart'
    ],

    tool:
      'rebootEc2Instance',

    resource:
      'instance',

    description:
      instanceId =>
        `Reboot EC2 instance ${instanceId}`,

    confirmation:
      instanceId =>
        `This action will reboot the EC2 instance.

Instance:
${instanceId}

Reply **confirm** to continue or **cancel** to abort.`
  },


  //
  // Release Elastic IP
  //

  {
    keywords: [
      'release',
      'remove'
    ],

    tool:
      'releaseElasticIp',

    resource:
      'elasticIp',

    description:
      allocationId =>
        `Release Elastic IP ${allocationId}`,

    confirmation:
      allocationId =>
        `This action will release the Elastic IP.

Allocation ID:
${allocationId}

This will permanently remove the Elastic IP from your AWS account.

Reply **confirm** to continue or **cancel** to abort.`
  },


  //
  // Associate Elastic IP
  //

  {
    keywords: [
      'associate',
      'assign'
    ],

    tool:
      'associateElasticIp',

    resource:
      'elasticIp',

    description:
      (
        elasticIp,
        instanceId
      ) =>
        `Associate Elastic IP ${elasticIp} with EC2 instance ${instanceId}`,

    confirmation:
      (
        elasticIp,
        instanceId
      ) =>
        `This action will associate the Elastic IP.

Elastic IP:
${elasticIp}

EC2 instance:
${instanceId}

Reply **confirm** to continue or **cancel** to abort.`
  }

]

//   {
//     keywords: [
//       'associate',
//       'assign'
//     ],

//     tool:
//       'associateElasticIp',

//     resource:
//       'elasticIp',

//     description:
//       (
//         allocationId,
//         instanceId
//       ) =>
//         `Associate Elastic IP ${allocationId} with EC2 instance ${instanceId}`,

//     confirmation:
//       (
//         allocationId,
//         instanceId
//       ) =>
//         `This action will associate the Elastic IP.

// Allocation ID:
// ${allocationId}

// EC2 instance:
// ${instanceId}

// Reply **confirm** to continue or **cancel** to abort.`
//   }

// ]

// import type {
//   ActionDefinition
// } from '@/types'


// export const ec2Actions: ActionDefinition[] = [

//   //
//   // Start EC2 instance
//   //

//   {
//     keywords: [
//       'start'
//     ],

//     tool:
//       'startEc2Instance',

//     resource:
//       'instance',

//     description:
//       instanceId =>
//         `Start EC2 instance ${instanceId}`,

//     confirmation:
//       instanceId =>
//         `This action will start the EC2 instance.

// Instance:
// ${instanceId}

// Reply **confirm** to continue or **cancel** to abort.`
//   },


//   //
//   // Stop EC2 instance
//   //

//   {
//     keywords: [
//       'stop'
//     ],

//     tool:
//       'stopEc2Instance',

//     resource:
//       'instance',

//     description:
//       instanceId =>
//         `Stop EC2 instance ${instanceId}`,

//     confirmation:
//       instanceId =>
//         `This action will stop the EC2 instance.

// Instance:
// ${instanceId}

// Reply **confirm** to continue or **cancel** to abort.`
//   },


//   //
//   // Reboot EC2 instance
//   //

//   {
//     keywords: [
//       'reboot',
//       'restart'
//     ],

//     tool:
//       'rebootEc2Instance',

//     resource:
//       'instance',

//     description:
//       instanceId =>
//         `Reboot EC2 instance ${instanceId}`,

//     confirmation:
//       instanceId =>
//         `This action will reboot the EC2 instance.

// Instance:
// ${instanceId}

// Reply **confirm** to continue or **cancel** to abort.`
//   },


//   //
//   // Release Elastic IP
//   //

//   {
//     keywords: [
//       'release',
//       'remove'
//     ],

//     tool:
//       'releaseElasticIp',

//     resource:
//       'elasticIp',

//     description:
//       allocationId =>
//         `Release Elastic IP ${allocationId}`,

//     confirmation:
//       allocationId =>
//         `This action will release the Elastic IP.

// Allocation ID:
// ${allocationId}

// This will permanently remove the Elastic IP from your AWS account.

// Reply **confirm** to continue or **cancel** to abort.`
//   }

// ]