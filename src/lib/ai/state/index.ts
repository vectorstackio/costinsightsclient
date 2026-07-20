// lib/ai/state/index.ts

import { BaseMessage } from '@langchain/core/messages'
import {
  Annotation,
  messagesStateReducer
} from '@langchain/langgraph'

import type { PendingAction } from '@/types'

export const GraphState = Annotation.Root({
  question: Annotation<string>({
    reducer: (x, y) => y ?? x,
    default: () => ''
  }),

  messages: Annotation<BaseMessage[]>({
    reducer: messagesStateReducer,
    default: () => []
  }),

  intent: Annotation<
    'query' | 'action' | 'confirm' | 'cancel' | 'unknown'
  >({
    reducer: (x, y) => y ?? x,
    default: () => 'unknown'
  }),

  pendingAction: Annotation<PendingAction | null>({
    reducer: (_old, value) => value,
    default: () => null
  })
})