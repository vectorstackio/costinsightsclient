// types/state/index.ts

import { BaseMessage } from '@langchain/core/messages'

export interface PendingAction {
  type: 'snapshot' | 'delete' | 'stop' | 'restart'
  tool: string
  args: Record<string, unknown>
  description: string
}

export interface AgentState {
  question: string
  messages?: BaseMessage[]
  answer?: string
  //intent?: 'query' | 'action' | 'unknown'
  intent?: 'query' | 'action' | 'confirm' | 'cancel' | 'unknown'
  pendingAction?: PendingAction | null
}