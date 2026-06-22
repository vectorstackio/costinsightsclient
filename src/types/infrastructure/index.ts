// types/infrastrucure/index.ts

export type InstanceMetrics = {
  instanceId: string
  name: string
  host: string
  privateIp: string
  instanceType: string
  cpuUsedPercent: number | null
  memoryUsedPercent: number | null
  diskUsedPercent: number | null
}

export type ApiResponse = {
  generatedAt: string
  instances: InstanceMetrics[]
}

export type State = {
  data: InstanceMetrics[]
  loading: boolean
  error: string | null
  lastUpdated: string | null
}

export type HistoryPoint = {
  timestamp: string
  value: number
}

export type InstanceHistory = {
  instanceId: string
  instanceType: string
  name: string
  host: string
  cpu: HistoryPoint[]
  memory: HistoryPoint[]
  disk: HistoryPoint[]
}

export type InfrastructureHistoryResponse = {
  generatedAt: string
  period: string
  instances: InstanceHistory[]
}

export type HistoryRange =
  | '1h'
  | '24h'
  | '7d'
  | '30d'