// components/Forbidden.tsx

'use client'

import { useRouter } from 'next/navigation'

const Forbidden = () => {
  const router = useRouter()

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
      <div className="w-full max-w-md rounded-xl bg-white p-8 text-center shadow-lg">

        {/* Icon */}
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
          <svg
            className="h-8 w-8 text-red-600"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v2m0 4h.01M12 3l9 4.5v5c0 5-3.5 9-9 11-5.5-2-9-6-9-11v-5L12 3z"
            />
          </svg>
        </div>

        {/* Title */}
        <h1 className="text-2xl font-bold text-slate-900">
          Access Forbidden
        </h1>

        {/* Message */}
        <p className="mt-2 text-sm text-slate-600">
          You don’t have permission to view this page.
          If you think this is a mistake, please contact your administrator.
        </p>

        {/* Actions */}
        <div className="mt-6 flex flex-col gap-3">

          <button
            onClick={() => router.push('/login')}
            className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-blue-700"
          >
            Go to Login
          </button>

          <button
            onClick={() => router.back()}
            className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            Go Back
          </button>
        </div>
      </div>
    </div>
  )
}

export default Forbidden