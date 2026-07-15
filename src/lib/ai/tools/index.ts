// lib/ai/tools/index.ts

export * from './costs'
export * from './infrastructure'

import { getMonthlyCosts } from './costs'
import {
  getInfrastructureHealth,
  getInfrastructureHistory
} from './infrastructure'

export const tools = [
  getMonthlyCosts,
  getInfrastructureHealth,
  getInfrastructureHistory
]