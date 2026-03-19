import { automationConfig } from '../config/automationConfig'
import { productConfig } from '../config/productConfig'
import type { PlayerState } from '../models/PlayerState'
import type { ResourceId } from '../models/Resource'
import { MarketSystem } from './MarketSystem'
import { ProductionSystem } from './ProductionSystem'

export class AutomationSystem {
  private lastAutoSellMinute = 0

  setTargetProduct(player: PlayerState, productId: ResourceId | null): void {
    player.automation.targetProductId = productId
  }

  toggleAutoProduction(player: PlayerState): boolean {
    player.automation.autoProductionEnabled = !player.automation.autoProductionEnabled
    return player.automation.autoProductionEnabled
  }

  toggleAutoSell(player: PlayerState): boolean {
    player.automation.autoSellEnabled = !player.automation.autoSellEnabled
    return player.automation.autoSellEnabled
  }

  setSellReserve(player: PlayerState, reserve: number): number {
    player.automation.sellReserve = Math.max(0, Math.min(9, reserve))
    return player.automation.sellReserve
  }

  runAutoProduction(player: PlayerState, productionSystem: ProductionSystem): { startedProductId?: ResourceId } {
    if (!player.automation.autoProductionEnabled || player.activeProduction || !player.automation.targetProductId) {
      return {}
    }

    const nextProductId = this.resolveNextProduct(player, player.automation.targetProductId)
    if (!nextProductId) {
      return {}
    }

    const result = productionSystem.startCraft(player, nextProductId)
    if (!result.ok) {
      return {}
    }

    return { startedProductId: nextProductId }
  }

  runAutoSell(
    player: PlayerState,
    currentMinute: number,
    marketSystem: MarketSystem,
    salesBonus: number,
  ): Array<{ productId: ResourceId; quantity: number; revenue: number }> {
    if (!player.automation.autoSellEnabled) {
      return []
    }

    if (currentMinute - this.lastAutoSellMinute < automationConfig.autoSellEveryMinutes) {
      return []
    }

    this.lastAutoSellMinute = currentMinute
    const sales: Array<{ productId: ResourceId; quantity: number; revenue: number }> = []

    ;(['plank', 'metalParts', 'toolkit'] as ResourceId[]).forEach((productId) => {
      const available = player.resources[productId] - player.automation.sellReserve
      if (available <= 0) {
        return
      }

      const result = marketSystem.sellProduct(player, productId, available, salesBonus)
      if (result.ok && result.revenue !== undefined) {
        sales.push({ productId, quantity: available, revenue: result.revenue })
      }
    })

    return sales
  }

  importState(lastAutoSellMinute: number): void {
    this.lastAutoSellMinute = lastAutoSellMinute
  }

  exportState(): { lastAutoSellMinute: number } {
    return { lastAutoSellMinute: this.lastAutoSellMinute }
  }

  private resolveNextProduct(player: PlayerState, targetProductId: ResourceId): ResourceId | null {
    const product = productConfig[targetProductId]
    if (!product || product.stage === 'raw' || !player.unlockedProducts.includes(targetProductId)) {
      return null
    }

    for (const input of product.inputs) {
      if (player.resources[input.resourceId] >= input.amount) {
        continue
      }

      const inputProduct = productConfig[input.resourceId]
      if (inputProduct.stage === 'raw') {
        return null
      }

      return this.resolveNextProduct(player, input.resourceId)
    }

    return targetProductId
  }
}
