export type ResourceId = 'wood' | 'ore' | 'plank' | 'metalParts' | 'toolkit'

export interface ResourceDefinition {
  id: ResourceId
  name: string
  category: 'raw' | 'processed' | 'finished'
  baseCapacity: number
  buyPrice?: number
  startingAmount: number
}
