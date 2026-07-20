// lib/ai/pendingActionStore.ts

import type {
  PendingAction
} from '@/types'

let pendingAction: PendingAction | null = null

export function getPendingAction() {
  return pendingAction
}

export function setPendingAction(
  action: PendingAction | null
) {
  pendingAction = action
}