// lib/ai/node/agent.ts

import { AgentState } from '../state'
import { model } from '../llm'
import { tools } from '../tools'

const modelWithTools = model.bindTools(tools)

export async function agentNode(
  state: AgentState
): Promise<Partial<AgentState>> {

  const response = await modelWithTools.invoke([
    {
      role: 'user',
      content: state.question,
    },
  ])

  return {
    messages: [
      ...(state.messages ?? []),
      response,
    ],
  }
}