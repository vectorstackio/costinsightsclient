// types/events/index.ts

export type AgentEvent =
  | {
    type: 'status'
    message: string
  }
  | {
    type: 'tool_start'
    tool: string
  }
  | {
    type: 'tool_end'
    tool: string
  }
  | {
    type: 'answer'
    content: string
  }