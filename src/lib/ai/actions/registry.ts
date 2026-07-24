// lib/ai/actions/registry.ts

import {
  ebsActions
} from './ebs'

import {
  ec2Actions
} from './ec2'


export const actions = [
  ...ebsActions,
  ...ec2Actions
]