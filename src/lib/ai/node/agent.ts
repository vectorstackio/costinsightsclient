// lib/ai/node/agent.ts

import { SystemMessage, AIMessage } from '@langchain/core/messages'

import { AgentState } from '../state'
import { model } from '../llm'
import { tools } from '../tools'

const systemPrompt = `
You are an AWS Cloud Operations Copilot.

Always verify the data before answering.
If the user's assumption is incorrect, explain the correction clearly.

Do not blindly agree with the user's question.

Format responses using GitHub Flavored Markdown.

Use:

- headings
- bullet lists
- numbered lists
- tables when comparing data
- code blocks for commands
- short paragraphs

Do not return HTML.
`

const modelWithTools = model.bindTools(tools)

export async function agentNode(
  state: AgentState
): Promise<Partial<AgentState>> {

  const response = await modelWithTools.invoke([
    new SystemMessage(systemPrompt),
    ...(state.messages ?? [])
  ])

  if (
    response instanceof AIMessage &&
    response.tool_calls?.length
  ) {
    return {
      messages: [response]
    }
  }

  return {
    messages: [response],
    // answer:
    //   typeof response.content === 'string'
    //     ? response.content
    //     : JSON.stringify(response.content)
  }
}

// import { SystemMessage, AIMessage } from '@langchain/core/messages'

// import { AgentState } from '../state'
// import { model } from '../llm'
// import { tools } from '../tools'

// const systemPrompt = `
// You are an AWS infrastructure assistant.

// Always verify the data before answering.
// If the user's assumption is incorrect, explain the correction clearly.

// Do not blindly agree with the user's question.

// Use:

// - headings
// - bullet lists
// - numbered lists
// - tables when comparing data
// - code blocks for commands
// - short paragraphs

// Do not return HTML.
// `

// const modelWithTools = model.bindTools(tools)

// export async function agentNode(
//   state: AgentState
// ): Promise<Partial<AgentState>> {
//   const response = await modelWithTools.invoke([
//     new SystemMessage(systemPrompt),
//     ...(state.messages ?? [])
//   ])

//   // If the model wants to call a tool, don't update the answer yet.
//   if (
//     response instanceof AIMessage &&
//     response.tool_calls?.length
//   ) {
//     return {
//       messages: [response]
//     }
//   }

//   return {
//     messages: [response],
//     answer:
//       response instanceof AIMessage
//         ? response.content.toString()
//         : ''
//   }
// }