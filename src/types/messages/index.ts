//types/messages/index.ts

export interface Message {
  userId: string | null
  role: string
  content: string
  conversationId: string
  threadId: string
}