// types/elasticips/index.ts

export interface ElasticIp {
  allocationId: string
  publicIp: string
  domain: string
  associationId?: string
  instanceId?: string
  networkInterfaceId?: string
  privateIpAddress?: string
  associated: boolean
  estimatedMonthlyCost?: number
}