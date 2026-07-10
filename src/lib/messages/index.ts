// lib/messages/index.ts

import type { Message } from '@/types'

export const getConversationHistory = async (userId: string, conversationId: string) => {
  try {
    const response =
      await fetch(
        `/api/messages?userId=${userId}&conversationId=${conversationId}`
      )

    const data = await response.json()
    const messages = data.records ?? []
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