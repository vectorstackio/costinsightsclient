// lib/ai/node/action.ts

import { AIMessage } from '@langchain/core/messages'

//import { GraphState } from '@/lib/ai/state'


export const actionNode = async (/*state: typeof GraphState.State*/) => {

  //console.log('Action requested:', state.question)

  return {
    messages: [
      new AIMessage(
        'This action requires confirmation before it can be executed.'
      )
    ]
  }
}