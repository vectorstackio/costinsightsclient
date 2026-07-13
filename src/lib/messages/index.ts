// lib/messages/index.ts

import type { Message, Conversation } from '@/types'

export const getConversationHistory = async (userId: string, conversationId: string) => {
  try {
    const response =
      await fetch(
        `/api/messages?userId=${userId}&conversationId=${conversationId}`
      )

    const result = await response.json()
    const messages = result.data.records ?? []
    return messages
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error',
    }
  }
}

export async function createMessage(data: Message): Promise<{
  success: boolean
  error?: string
}> {
  try {
    await fetch('/api/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })

    return {
      success: true,
    }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error',
    }
  }
}

export const getConversations = async (userId: string) => {
  try {
    const response =
      await fetch(
        `/api/conversations?userId=${userId}`
      )

    const result = await response.json()
    const conversations = result.data.records ?? []
    return conversations
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error',
    }
  }
}

export const createConversation = async (data: Conversation) => {
  try {
    const response = await fetch('/api/conversations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })

    const result = await response.json()

    return {
      success: true,
      _id: result.data.record._id
    }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error',
    }
  }
}

export const updateConversation = async (data: Conversation, id: string) => {
  try {
    const response = await fetch(`/api/conversations/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })

    await response.json()

    return {
      success: true,
    }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error',
    }
  }
}

export const getConversationTitle = async (question: string) => {
  try {
    const response = await fetch('/api/conversations/title', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question }),
    })

    const result = await response.json()

    return result.title
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error',
    }
  }
}