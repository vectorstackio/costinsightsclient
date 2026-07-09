// app/copilot/page.tsx

'use client'

import { useState } from 'react'

import CopilotChat from '@/components/ai/CopilotChat'
import Forbidden from '@/components/Forbidden'
import { useAuth } from '@/lib/hooks/useAuth'

export default function CopilotPage() {
  const [forbidden, setForbidden] = useState(false)
  useAuth(setForbidden)

  if (forbidden) {
    return <Forbidden />
  }

  return (
    <main className='p-8'>
      <CopilotChat />
    </main>
  )
}