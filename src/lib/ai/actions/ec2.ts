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
  // Assign Elastic IP
  //

  {
    keywords: [
      'assign an elastic ip',
      'assign elastic ip',
      'allocate an elastic ip',
      'allocate elastic ip',
      'give an elastic ip',
      'give elastic ip',
      'assign an eip',
      'assign eip',
      'allocate an eip',
      'allocate eip',
      'give an eip',
      'give eip'
    ],

    tool:
      'assignElasticIp',

    resource:
      'instance',

    description:
      instanceId =>
        `Assign an Elastic IP to EC2 instance ${instanceId}`,

    confirmation:
      instanceId =>
        `This action will assign an Elastic IP to the EC2 instance.

Instance:
${instanceId}

If a spare Elastic IP is available, it will be used.
If no spare Elastic IP is available, a new Elastic IP will be allocated.

Reply **confirm** to continue or **cancel** to abort.`
  },


  //
  // Associate Elastic IP
  //

  {
    keywords: [
      'associate elastic ip',
      'associate an elastic ip',
      'associate eip',
      'associate an eip'
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