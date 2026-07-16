// lib/ai/node/classifier.ts

import {
  HumanMessage,
  SystemMessage
} from '@langchain/core/messages'

import {
  model
} from '../llm'

import {
  GraphState
} from '@/lib/ai/state'


const classifierPrompt = `
Classify the user request.

Return exactly one word:

query
action
confirm
cancel

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

confirm:
- User is approving a previously requested action
- Examples:
"confirm"
"yes"
"proceed"
"go ahead"

cancel:
- User is rejecting a previously requested action
- Examples:
"cancel"
"no"
"abort"
"stop"

Only return one word.
`


export const classifierNode = async (
  state: typeof GraphState.State
) => {

  const response = await model.invoke([
    new SystemMessage(classifierPrompt),
    new HumanMessage(state.question)
  ])

  const intent =
    response.content
      .toString()
      .trim()
      .toLowerCase()

  //
  // If there is a pending action,
  // confirmation responses should take priority.
  //

  if (state.pendingAction) {
    if (
      [
        'confirm',
        'yes',
        'proceed',
        'go ahead'
      ].includes(intent)
    ) {
      return {
        intent: 'confirm'
      }
    }

    if (
      [
        'cancel',
        'no',
        'abort',
        'stop'
      ].includes(intent)
    ) {
      return {
        intent: 'cancel'
      }
    }
  }

  //
  // Normal classification
  //

  if (intent === 'action') {
    return {
      intent: 'action'
    }
  }

  return {
    intent: 'query'
  }
}

// import { model } from '../llm'
// import { SystemMessage, HumanMessage } from '@langchain/core/messages'
// import { GraphState } from '@/lib/ai/state'


// const classifierPrompt = `
// Classify the user request.

// Return exactly one word:

// query
// action

// query:
// - Asking for information
// - Asking for analysis
// - Asking for recommendations

// Examples:
// "Show my EC2 instances"
// "Why did costs increase?"
// "What volumes are unused?"

// action:
// - Changes AWS resources
// - Creates resources
// - Deletes resources
// - Starts or stops resources

// Examples:
// "Create a snapshot"
// "Stop this EC2 instance"
// "Delete this volume"

// Only return query or action.
// `


// export const classifierNode = async(
//   state: typeof GraphState.State
// ) => {

//   const response = await model.invoke([
//     new SystemMessage(classifierPrompt),
//     new HumanMessage(state.question)
//   ])

//   const intent =
//     response.content.toString().trim()


//   return {
//     intent:
//       intent === 'action'
//         ? 'action'
//         : 'query'
//   }

// }