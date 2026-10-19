// lib/ai/llm/index.ts

import { ChatOpenAI } from '@langchain/openai'

export const model = new ChatOpenAI({
  model: 'gpt-5-mini',
  temperature: 0,
})