import type { ResourceId } from './Resource'

export type MarketTrend = 'up' | 'down' | 'stable'

export interface ProductMarketState {
  productId: ResourceId
  multiplier: number
  trend: MarketTrend
  unitPrice: number
  history: number[]
}

export interface MarketSnapshot {
  lastUpdatedMinute: number
  products: ProductMarketState[]
}
