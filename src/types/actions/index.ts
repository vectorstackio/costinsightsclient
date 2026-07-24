// types/actions/index.ts

export type ActionDefinition = {
  keywords: string[]
  tool: string
  resource: 'volume' | 'instance'

  description: (
    id: string,
    size?: number
  ) => string

  confirmation: (
    id: string,
    size?: number
  ) => string
}