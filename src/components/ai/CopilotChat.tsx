// components/ai/CopilotChat.tsx

'use client'

import { useState } from 'react'

type ChatMessage = {
  role: 'user' | 'assistant'
  content: string
}

export default function CopilotChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [question, setQuestion] = useState('')
  const [loading, setLoading] = useState(false)

  async function sendQuestion() {
    if (!question.trim()) return

    const userMessage: ChatMessage = {
      role: 'user',
      content: question
    }

    setMessages(prev => [...prev, userMessage])
    setLoading(true)

    const response = await fetch('/api/ai', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        question
      })
    })

    const data = await response.json()

    setMessages(prev => [
      ...prev,
      {
        role: 'assistant',
        content: data.answer
      }
    ])

    setQuestion('')
    setLoading(false)
  }

  return (
    <div className='mx-auto flex max-w-4xl flex-col gap-4'>

      <h1 className='text-3xl font-bold'>
        AI Cloud Operations Copilot
      </h1>

      <div className='rounded-lg border p-4 h-[600px] overflow-y-auto space-y-4'>

        {messages.map((message, index) => (
          <div
            key={index}
            className={
              message.role === 'user'
                ? 'text-right'
                : ''
            }
          >
            <div
              className={
                message.role === 'user'
                  ? 'inline-block rounded bg-blue-600 px-4 py-2 text-white'
                  : 'inline-block rounded bg-slate-200 px-4 py-2'
              }
            >
              {message.content}
            </div>
          </div>
        ))}

        {loading && (
          <div className='italic text-slate-500'>
            Analysing your AWS environment...
          </div>
        )}

      </div>

      <div className='flex gap-2'>

        <input
          className='flex-1 rounded border px-3 py-2'
          placeholder='Ask about your AWS environment...'
          value={question}
          onChange={e => setQuestion(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') {
              sendQuestion()
            }
          }}
        />

        <button
          onClick={sendQuestion}
          disabled={loading}
          className='rounded bg-blue-600 px-6 py-2 text-white disabled:opacity-50'
        >
          Ask
        </button>

      </div>

    </div>
  )
}