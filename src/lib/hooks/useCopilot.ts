// lib/hooks/useCopilot.ts

import { useState } from 'react'

import type { AgentEvent } from '@/types'

type ChatMessage = {
  role: 'user' | 'assistant'
  content: string
}

export const useCopilot = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [activity, setActivity] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [lastAnswer, setLastAnswer] = useState('')

  const ask = async(question: string, conversationId: string) => {
    const userMessage: ChatMessage = {
      role: 'user',
      content: question
    }

    const assistantMessage: ChatMessage = {
      role: 'assistant',
      content: ''
    }

    const conversation = [
      ...messages,
      userMessage
    ]

    setMessages([
      ...conversation,
      assistantMessage
    ])

    setLoading(true)

    try {
      const response = await fetch(
        '/api/ai',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            conversationId,
            question,
            messages: conversation
          })
        }
      )

      if (!response.body) throw new Error('No response body')
      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let assistantContent = ''

      while (true) {
        const {
          done,
          value
        } = await reader.read()

        if (done) break
        const chunk = decoder.decode(value, { stream: true })
        const lines = chunk.split('\n').filter(Boolean)

        for (const line of lines) {
          if (!line.startsWith('data:')) continue
          const event: AgentEvent =
            JSON.parse(
              line.replace(
                'data: ',
                ''
              )
            )

          switch (event.type) {
          case 'status':
            setActivity(event.message)
            break

          case 'tool_start':
            setActivity(`Running ${event.tool}...`)
            break

          case 'tool_end':
            setActivity(`${event.tool} completed`)
            break

          case 'answer':
            assistantContent += event.content
            setLastAnswer(assistantContent)
            setMessages([
              ...conversation,
              {
                role: 'assistant',
                content: assistantContent
              }
            ])

            break
          }

        }

      }
    } finally {
      setLoading(false)
      setActivity('')
    }
  }

  return {
    messages,
    setMessages,
    ask,
    loading,
    activity,
    lastAnswer
  }

}