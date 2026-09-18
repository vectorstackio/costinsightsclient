// app/copilot/page.tsx

'use client'

import { useState } from 'react'
import Link from 'next/link'

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
      <div className="mt-4 border-b border-slate-200">
        <nav className="flex gap-6 text-sm font-medium">
          <Link href="/dashboard" className="border-b-2 border-transparent pb-2 text-slate-700">Home</Link>
          <Link href="/insights" className="border-b-2 border-transparent pb-2 text-slate-500 hover:text-slate-700">Insights</Link>
          <Link href="/infrastructure" className="border-b-2 border-transparent pb-2 text-slate-500 hover:text-slate-700">Infrastructure</Link>
          <Link href="/reports" className="border-b-2 border-transparent pb-2 text-slate-500 hover:text-slate-700">Reports</Link>
          <Link href="/copilot" className="border-b-2 border-blue-600 pb-2 text-blue-500 hover:text-blue-700">Copilot</Link>
        </nav>
      </div>

      <div className="pb-4"></div>

      <CopilotChat />
    </main>
  )
}