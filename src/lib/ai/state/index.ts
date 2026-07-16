// lib/ai/state/index.ts

import { BaseMessage } from '@langchain/core/messages'
import {
  Annotation,
  messagesStateReducer
} from '@langchain/langgraph'

export interface PendingAction {
  tool: string
  args: Record<string, unknown>
  description: string
}

export interface AgentState {
  question: string
  messages?: BaseMessage[]
  answer?: string
  intent?: 'query' | 'action' | 'unknown'
  pendingAction?: PendingAction | null
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
  }),

  pendingAction: Annotation<{
    tool: string
    args: Record<string, unknown>
  } | null>({
    reducer: (_old, value) => value,
    default: () => null
  })

  // pendingAction: Annotation<PendingAction | null>({
  //   reducer: (_, y) => y,
  //   default: () => null
  // })
})

// import { BaseMessage } from '@langchain/core/messages'
// import { Annotation, messagesStateReducer } from '@langchain/langgraph'

// export interface AgentState {
//   question: string
//   messages?: BaseMessage[]
//   answer?: string
// }

// export const GraphState = Annotation.Root({
//   question: Annotation<string>({
//     reducer: (x, y) => y ?? x,
//     default: () => ''
//   }),

//   messages: Annotation<BaseMessage[]>({
//     reducer: messagesStateReducer,
//     default: () => []
//   }),

//   intent: Annotation<
//     'query' | 'action' | 'unknown'
//   >({
//     reducer: (x, y) => y ?? x,
//     default: () => 'unknown'
//   })
// })