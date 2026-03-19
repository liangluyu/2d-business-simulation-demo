import { initialMarketMultipliers, marketConfig, marketVolatility } from '../config/marketConfig'
import { marketProductIds, productConfig } from '../config/productConfig'
import type { MarketSnapshot, MarketTrend, ProductMarketState } from '../models/Market'
import type { PlayerState } from '../models/PlayerState'
import type { ResourceId } from '../models/Resource'
import { ResourceSystem } from './ResourceSystem'

export class MarketSystem {
  private readonly resourceSystem: ResourceSystem
  private state: MarketSnapshot = {
    lastUpdatedMinute: 0,
    products: marketProductIds.map((productId) => ({
      productId,
      multiplier: initialMarketMultipliers[productId] ?? 1,
      trend: 'stable',
      unitPrice: productConfig[productId].suggestedPrice,
      history: [productConfig[productId].suggestedPrice],
    })),
  }

  constructor(resourceSystem: ResourceSystem) {
    this.resourceSystem = resourceSystem
  }

  initialize(currentMinute: number): void {
    this.state.lastUpdatedMinute = currentMinute
    this.recalculatePrices()
  }

  importState(snapshot: MarketSnapshot): void {
    this.state = {
      lastUpdatedMinute: snapshot.lastUpdatedMinute,
      products: snapshot.products.map((product) => ({
        ...product,
        history: product.history && product.history.length > 0 ? product.history : [product.unitPrice],
      })),
    }
  }

  exportState(): MarketSnapshot {
    return structuredClone(this.state)
  }

  getSnapshot(): MarketSnapshot {
    return this.exportState()
  }

  getProductMarket(productId: ResourceId): ProductMarketState | undefined {
    return this.state.products.find((item) => item.productId === productId)
  }

  getMultiplier(productId: ResourceId): number {
    return this.getProductMarket(productId)?.multiplier ?? 1
  }

  tick(currentMinute: number): boolean {
    if (currentMinute - this.state.lastUpdatedMinute < marketConfig.updateEveryMinutes) {
      return false
    }

    this.state.lastUpdatedMinute = currentMinute
    this.state.products = this.state.products.map((entry) => {
      const volatility = marketVolatility[entry.productId]
      const delta = (Math.random() * 2 - 1) * Math.min(marketConfig.stepRange, volatility)
      const nextMultiplier = this.clamp(entry.multiplier + delta, marketConfig.minMultiplier, marketConfig.maxMultiplier)
      const trend: MarketTrend =
        nextMultiplier > entry.multiplier + 0.02 ? 'up' : nextMultiplier < entry.multiplier - 0.02 ? 'down' : 'stable'

      return {
        productId: entry.productId,
        multiplier: Number(nextMultiplier.toFixed(2)),
        trend,
        unitPrice: Math.round(productConfig[entry.productId].suggestedPrice * nextMultiplier),
        history: [
          ...entry.history.slice(-7),
          Math.round(productConfig[entry.productId].suggestedPrice * nextMultiplier),
        ],
      }
    })

    return true
  }

  sellProduct(
    player: PlayerState,
    productId: ResourceId,
    quantity: number,
    salesBonus: number,
  ): { ok: boolean; reason?: string; revenue?: number } {
    const market = this.getProductMarket(productId)
    if (!market) {
      return { ok: false, reason: '该商品暂时没有市场报价。' }
    }

    if (!this.resourceSystem.removeResource(player, productId, quantity)) {
      return { ok: false, reason: '库存不足，无法出售。' }
    }

    const revenue = Math.round(market.unitPrice * quantity * salesBonus)
    player.gold += revenue
    return { ok: true, revenue }
  }

  private recalculatePrices(): void {
    this.state.products = this.state.products.map((entry) => ({
      ...entry,
      unitPrice: Math.round(productConfig[entry.productId].suggestedPrice * entry.multiplier),
      history: entry.history.length > 0 ? entry.history : [Math.round(productConfig[entry.productId].suggestedPrice * entry.multiplier)],
    }))
  }

  private clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value))
  }
}
