import { requireSession } from '@/lib/auth/server'
// lib/ai/pendingActionStore.ts

import type {
  PendingAction
} from '@/types'

const pendingActions = new Map<string, PendingAction>()

export async function getPendingAction() {
  return pendingActions.get((await requireSession()).userId) ?? null
}

export async function setPendingAction(
  action: PendingAction | null
) {
  const { userId } = await requireSession()
  if (action) pendingActions.set(userId, action)
  else pendingActions.delete(userId)
}