// lib/ai/tools/index.ts

export * from './costs'
export * from './infrastructure'
export * from './actions'

import { getMonthlyCosts } from './costs'
import {
  getInfrastructureHealth,
  getInfrastructureHistory,
  getEc2Instances,
  getEbsVolumes,
  getEc2Inventory,
  getLambdaInventory,
  getApiGatewayInventory,
  getIdleEc2Instances
} from './infrastructure'
import {
  createEbsSnapshot,
  deleteEbsVolume,
  resizeEbsVolume,
  expandEbsFilesystem,
  startEc2Instance,
  stopEc2Instance,
  rebootEc2Instance
} from './actions'

export const tools = [
  getMonthlyCosts,
  getInfrastructureHealth,
  getInfrastructureHistory,
  getEc2Instances,
  getEbsVolumes,
  createEbsSnapshot,
  deleteEbsVolume,
  resizeEbsVolume,
  expandEbsFilesystem,
  startEc2Instance,
  stopEc2Instance,
  rebootEc2Instance,
  getEc2Inventory,
  getLambdaInventory,
  getApiGatewayInventory,
  getIdleEc2Instances
]