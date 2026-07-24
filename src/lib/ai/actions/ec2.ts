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
  }

]