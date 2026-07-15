// lib/ai/tools/index.ts

export * from './costs'
export * from './infrastructure'
export * from './actions'

import { getMonthlyCosts } from './costs'
import {
  getInfrastructureHealth,
  getInfrastructureHistory,
  getEc2Instances,
  getEbsVolumes
} from './infrastructure'
import { createEbsSnapshot } from './actions'

export const tools = [
  getMonthlyCosts,
  getInfrastructureHealth,
  getInfrastructureHistory,
  getEc2Instances,
  getEbsVolumes,
  createEbsSnapshot
]