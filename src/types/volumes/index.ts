// types/volumes/index.ts

export type EBSVolumeType =
  | 'gp3'
  | 'gp2'
  | 'io1'
  | 'io2'
  | 'st1'
  | 'sc1'

export interface EBSVolume {
  volumeId: string
  state: string
  size: number
  type: EBSVolumeType
  encrypted: boolean
  availabilityZone: string
  created: string
  name?: string
  attachedInstanceIds: string[]
  estimatedMonthlyCost?: number
}

// export interface EBSVolume {
//   volumeId: string
//   state: string
//   size: number
//   type: string
//   encrypted: boolean
//   availabilityZone: string
//   created: string
//   name?: string
//   attachedInstanceIds: string[]
//   estimatedMonthlyCost?: number
// }