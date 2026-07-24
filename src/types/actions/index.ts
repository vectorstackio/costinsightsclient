// types/actions/index.ts

export type ActionDefinition = {
  keywords: string[]
  tool: string
  resource: 'volume' | 'instance'

  description: (
    id: string
  ) => string

  confirmation: (
    id: string
  ) => string
}