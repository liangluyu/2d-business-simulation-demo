import type { ResourceId } from './Resource'

export interface ProductInput {
  resourceId: ResourceId
  amount: number
}

export interface ProductDefinition {
  id: ResourceId
  name: string
  description: string
  stage: 'raw' | 'intermediate' | 'finished'
  craftMinutes: number
  inputs: ProductInput[]
  outputAmount: number
  suggestedPrice: number
  unlockUpgradeId?: string
}
