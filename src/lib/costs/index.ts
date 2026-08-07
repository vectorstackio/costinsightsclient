// lib/costs/index.ts

import { EBSVolume } from '@/types'

export const calculateEbsCost = (volume: EBSVolume): number | undefined => {

  const prices = {
    gp3: 0.08,
    gp2: 0.10,
    io1: 0.125,
    io2: 0.125,
    st1: 0.045,
    sc1: 0.015
  }

  const price = prices[volume.type]

  if (!price) {
    return undefined
  }

  return Number((volume.size * price).toFixed(2))
}

export const calculateElasticIpCost = () => {
  const hourlyCost = 0.005
  const hoursPerMonth = 730

  return Number((hourlyCost * hoursPerMonth).toFixed(2))
}