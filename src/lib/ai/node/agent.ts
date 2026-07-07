// lib/ai/node/agent.ts

import { AgentState } from '../state'
import { model } from '../llm'
import { tools } from '../tools'
import { HumanMessage } from '@langchain/core/messages'

const modelWithTools = model.bindTools(tools)

export async function agentNode(
  state: AgentState
): Promise<Partial<AgentState>> {

  const messages = state.messages?.length
    ? state.messages
    : [
      new HumanMessage(state.question)
    ]

  const response = await modelWithTools.invoke(messages)

  return {
    messages: [
      response
    ],
    answer: response.content.toString()
  }
}