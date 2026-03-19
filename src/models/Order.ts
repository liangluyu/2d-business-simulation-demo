import type { ResourceId } from './Resource'

export type OrderRisk = 'stable' | 'rush' | 'premium'

export interface Order {
  id: string
  clientName: string
  productId: ResourceId
  quantity: number
  rewardGold: number
  expiresAtMinute: number
  risk: OrderRisk
  createdAtMinute: number
}
