//types/messages/index.ts

export interface Message {
  userId: string | null
  role: string
  content: string
  conversationId: string
  threadId: string
}

export interface Conversation {
  userId: string | null
  title: string
  id: string
}