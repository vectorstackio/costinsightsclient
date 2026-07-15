// lib/ai/state/index.ts

import { BaseMessage } from '@langchain/core/messages'
import { Annotation, messagesStateReducer } from '@langchain/langgraph'

export interface AgentState {
  question: string
  messages?: BaseMessage[]
  answer?: string
}

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
    'query' | 'action' | 'unknown'
  >({
    reducer: (x, y) => y ?? x,
    default: () => 'unknown'
  })
})