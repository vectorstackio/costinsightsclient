// lib/ai/node/classifier.ts

import { model } from '../llm'
import { SystemMessage, HumanMessage } from '@langchain/core/messages'
import { GraphState } from '@/lib/ai/state'


const classifierPrompt = `
Classify the user request.

Return exactly one word:

query
action

query:
- Asking for information
- Asking for analysis
- Asking for recommendations

Examples:
"Show my EC2 instances"
"Why did costs increase?"
"What volumes are unused?"

action:
- Changes AWS resources
- Creates resources
- Deletes resources
- Starts or stops resources

Examples:
"Create a snapshot"
"Stop this EC2 instance"
"Delete this volume"

Only return query or action.
`


export const classifierNode = async(
  state: typeof GraphState.State
) => {

  const response = await model.invoke([
    new SystemMessage(classifierPrompt),
    new HumanMessage(state.question)
  ])

  const intent =
    response.content.toString().trim()


  return {
    intent:
      intent === 'action'
        ? 'action'
        : 'query'
  }

}