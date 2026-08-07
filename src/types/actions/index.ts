// types/actions/index.ts

export type ActionDefinition = {
  keywords: string[]
  tool: string
  resource: 'volume' | 'instance' | 'elasticIp'

  description: (
    id: string,
    second?: string | number
  ) => string

  confirmation: (
    id: string,
    second?: string | number
  ) => string
}