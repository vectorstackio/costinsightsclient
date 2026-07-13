// components/ai/CopilotChat.tsx

'use client'

//import crypto from 'crypto'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

import { USER_ID_NAME } from '@/lib/auth'
import { getConversationHistory, createMessage, getConversations, createConversation } from '@/lib/messages'

import type { Message, Conversation } from '@/types'

import 'highlight.js/styles/github.css'

type ChatMessage = {
  role: 'user' | 'assistant'
  content: string
}

export default function CopilotChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [question, setQuestion] = useState('')
  const [loading, setLoading] = useState(false)
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [conversations, setConversations] = useState<{
    id: string
    title: string
  }[]>([
    {
      id: '12345',
      title: 'Infrastructure Health'
    },
    {
      id: '67890',
      title: 'AWS Costs'
    }
  ])
  const chatEndRef = useRef<HTMLDivElement>(null)
  const router = useRouter()

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({
      behavior: 'smooth'
    })
  }, [messages])

  useEffect(() => {
    const load = async () => {
      const id = sessionStorage.getItem(USER_ID_NAME) ?? ''
      if (!id) {
        router.push('/logout')
        return
      }
      setUserId(id)
      const results = await getConversations(id)
      setConversations(results)
    }

    load()
  }, [])

  async function sendQuestion() {

    if (!question.trim()) return

    const userQuestion = question

    const id =
      conversationId ??
      crypto.randomUUID()

    if (!conversationId) {
      setConversationId(id)
      const update: Conversation = {
        userId,
        id,
        title: 'Mike Testing 3'
      }

      await createConversation(update)
      const updatedConversations = [
        ...conversations,
        update
      ]
      setConversations(updatedConversations)
    }

    const remoteUserMessage: Message = {
      userId,
      conversationId: id,
      threadId: '12345',
      role: 'user',
      content: userQuestion
    }

    await createMessage(remoteUserMessage)

    const userMessage: ChatMessage = {
      role: 'user',
      content: userQuestion
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

    setQuestion('')
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
            conversationId: id,
            question: userQuestion,
            messages: conversation
          })
        }
      )

      if (!response.body) {
        throw new Error('No response body')
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()

      let assistantContent = ''

      while (true) {

        const {
          done,
          value
        } = await reader.read()

        if (done) break

        const chunk =
          decoder.decode(
            value,
            {
              stream: true
            }
          )

        assistantContent += chunk

        setMessages([
          ...conversation,
          {
            role: 'assistant',
            content: assistantContent
          }
        ])

      }

      const remoteAssistantMessage: Message = {
        userId,
        conversationId: id,
        threadId: '12345',
        role: 'assistant',
        content: assistantContent
      }

      await createMessage(remoteAssistantMessage)

    } catch (err) {

      if (err instanceof Error) {
        setLoading(false)
      }

    } finally {

      setLoading(false)

    }

  }

  const startNewConversation = () => {

    setConversationId(null)
    setMessages([])
    setQuestion('')
  }

  async function selectConversation(id: string) {

    if (!userId) return

    setConversationId(id)

    const history =
      await getConversationHistory(
        userId,
        id
      )

    setMessages(history)

  }


  return (

    <div className='flex h-screen'>

      {/* Sidebar */}

      <aside className='w-72 border-r bg-slate-100 flex flex-col'>

        <div className='p-4'>

          <button
            onClick={startNewConversation}
            className='w-full rounded bg-blue-600 px-4 py-2 text-white'
          >
            + New conversation
          </button>

        </div>

        <div className='flex-1 overflow-y-auto'>

          {conversations.map(conversation => (

            <button
              key={conversation.id}
              onClick={() => selectConversation(conversation.id)}
              className={
                `w-full border-b px-4 py-3 text-left hover:bg-slate-200 ${conversation.id === conversationId
                  ? 'bg-slate-300'
                  : ''
                }`
              }
            >

              <div className='truncate font-medium'>
                {conversation.title}
              </div>

            </button>

          ))}

        </div>

      </aside>

      {/* Main */}

      <main className='flex flex-1 flex-col overflow-hidden'>

        <header className='border-b'>
          <div className='mx-auto w-full max-w-4xl p-4'>
            <h1 className='text-2xl font-bold'>
              AI Cloud Operations Copilot
            </h1>
          </div>
        </header>

        <div className='flex-1 overflow-y-auto'>
          <div className='mx-auto w-full max-w-4xl space-y-4 p-6'>

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
                      ? 'inline-block rounded bg-blue-600 px-4 py-2 text-white prose prose-sm max-w-none'
                      : 'inline-block rounded bg-slate-200 px-4 py-2 prose prose-sm max-w-none'
                  }
                >

                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    rehypePlugins={[rehypeHighlight]}
                  >
                    {message.content}
                  </ReactMarkdown>

                </div>

              </div>

            ))}

            <div ref={chatEndRef} />

            {loading && (
              <div className='italic text-slate-500'>
                Analysing your AWS environment...
              </div>
            )}

          </div>
        </div>

        <div className='border-t bg-white'>
          <div className='mx-auto w-full max-w-4xl p-4'>

            <div className='flex items-end gap-2 rounded-2xl border bg-white p-2 shadow-sm'>

              <input
                className='flex-1 border-0 bg-transparent px-3 py-2 outline-none'
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
                className='rounded-xl bg-blue-600 px-5 py-2 text-white disabled:opacity-50'
              >
                Ask
              </button>

            </div>

          </div>
        </div>

      </main>

    </div>

  )
}