// lib/ai/state/index.ts

import { BaseMessage } from '@langchain/core/messages'

export interface AgentState {
  question: string
  messages?: BaseMessage[]
  answer?: string
}