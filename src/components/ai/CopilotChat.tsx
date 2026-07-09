// components/ai/CopilotChat.tsx

'use client'

import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'

import 'highlight.js/styles/github.css'

import { useEffect, useRef, useState } from 'react'

type ChatMessage = {
  role: 'user' | 'assistant'
  content: string
}

export default function CopilotChat() {

  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [question, setQuestion] = useState('')
  const [loading, setLoading] = useState(false)
  const chatEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({
      behavior: 'smooth'
    })
  }, [messages])


  async function sendQuestion() {

    if (!question.trim()) return


    const userQuestion = question


    const userMessage: ChatMessage = {
      role: 'user',
      content: userQuestion
    }


    const assistantMessage: ChatMessage = {
      role: 'assistant',
      content: ''
    }


    setMessages(prev => [
      ...prev,
      userMessage,
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
            question: userQuestion,
            //messages
            messages: [
              ...messages,
              userMessage
            ]
          })
        }
      )

      if (!response.body) {
        setLoading(false)
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


        setMessages(prev => {

          const updated = [...prev]

          updated[updated.length - 1] = {
            role: 'assistant',
            content: assistantContent
          }

          return updated
        })

      }
    } catch(err) {
      if(err instanceof Error) {
        setLoading(false)
      }
      //console.log(err)
    } finally {
      setLoading(false)
    }
  }


  return (
    <div className='mx-auto flex max-w-4xl flex-col gap-4'>

      <h1 className='text-3xl font-bold'>
        AI Cloud Operations Copilot
      </h1>


      <div className='h-[600px] space-y-4 overflow-y-auto rounded-lg border p-4'>

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
                  ? 'inline-block rounded bg-blue-600 px-4 py-2 text-white prose prose-sm max-w-none dark:prose-invert'
                  : 'inline-block rounded bg-slate-200 px-4 py-2 prose prose-sm max-w-none dark:prose-invert'
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


      <div className='flex gap-2'>

        <input
          className='flex-1 rounded border px-3 py-2'
          placeholder='Ask about your AWS environment...'
          value={question}
          onChange={
            e => setQuestion(e.target.value)
          }
          onKeyDown={
            e => {
              if (e.key === 'Enter') {
                sendQuestion()
              }
            }
          }
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

// 'use client'

// import ReactMarkdown from 'react-markdown'
// import remarkGfm from 'remark-gfm'
// import rehypeHighlight from 'rehype-highlight'

// import 'highlight.js/styles/github.css'

// import { useState } from 'react'

// type ChatMessage = {
//   role: 'user' | 'assistant'
//   content: string
// }

// export default function CopilotChat() {
//   const [messages, setMessages] = useState<ChatMessage[]>([])
//   const [question, setQuestion] = useState('')
//   const [loading, setLoading] = useState(false)

//   async function sendQuestion() {
//     if (!question.trim()) return

//     const userMessage: ChatMessage = {
//       role: 'user',
//       content: question
//     }

//     setMessages(prev => [...prev, userMessage])
//     setLoading(true)

//     const response = await fetch('/api/ai', {
//       method: 'POST',
//       headers: {
//         'Content-Type': 'application/json'
//       },
//       body: JSON.stringify({
//         question
//       })
//     })

//     const data = await response.json()

//     setMessages(prev => [
//       ...prev,
//       {
//         role: 'assistant',
//         content: data.answer
//       }
//     ])

//     setQuestion('')
//     setLoading(false)
//   }

//   return (
//     <div className='mx-auto flex max-w-4xl flex-col gap-4'>

//       <h1 className='text-3xl font-bold'>
//         AI Cloud Operations Copilot
//       </h1>

//       <div className='rounded-lg border p-4 h-[600px] overflow-y-auto space-y-4'>

//         {messages.map((message, index) => (
//           <div
//             key={index}
//             className={
//               message.role === 'user'
//                 ? 'text-right'
//                 : ''
//             }
//           >
//             <div
//               className={
//                 message.role === 'user'
//                   ? 'inline-block rounded bg-blue-600 px-4 py-2 text-white prose prose-sm max-w-none dark:prose-invert'
//                   : 'inline-block rounded bg-slate-200 px-4 py-2 prose prose-sm max-w-none dark:prose-invert'
//               }
//             >
//               <ReactMarkdown
//                 remarkPlugins={[remarkGfm]}
//                 rehypePlugins={[rehypeHighlight]}
//               >
//                 {message.content}
//               </ReactMarkdown>
//             </div>
//           </div>
//         ))}

//         {loading && (
//           <div className='italic text-slate-500'>
//             Analysing your AWS environment...
//           </div>
//         )}

//       </div>

//       <div className='flex gap-2'>

//         <input
//           className='flex-1 rounded border px-3 py-2'
//           placeholder='Ask about your AWS environment...'
//           value={question}
//           onChange={e => setQuestion(e.target.value)}
//           onKeyDown={e => {
//             if (e.key === 'Enter') {
//               sendQuestion()
//             }
//           }}
//         />

//         <button
//           onClick={sendQuestion}
//           disabled={loading}
//           className='rounded bg-blue-600 px-6 py-2 text-white disabled:opacity-50'
//         >
//           Ask
//         </button>

//       </div>

//     </div>
//   )
// }