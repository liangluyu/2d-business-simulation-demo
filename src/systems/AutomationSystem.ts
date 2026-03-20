import { automationConfig } from '../config/automationConfig'
import { productConfig } from '../config/productConfig'
import type { AutoPurchaseMode, PlayerState } from '../models/PlayerState'
import type { ResourceId } from '../models/Resource'
import { EconomySystem } from './EconomySystem'
import { MarketSystem } from './MarketSystem'
import { ProductionSystem } from './ProductionSystem'
import { ResourceSystem } from './ResourceSystem'

export class AutomationSystem {
  private lastAutoPurchaseMinute = 0
  private lastAutoSellMinute = 0

  setTargetProduct(player: PlayerState, productId: ResourceId | null): void {
    player.automation.targetProductId = productId
  }

  toggleAutoProduction(player: PlayerState): boolean {
    player.automation.autoProductionEnabled = !player.automation.autoProductionEnabled
    return player.automation.autoProductionEnabled
  }

  toggleAutoPurchase(player: PlayerState): boolean {
    player.automation.autoPurchaseEnabled = !player.automation.autoPurchaseEnabled
    return player.automation.autoPurchaseEnabled
  }

  setAutoPurchaseMode(player: PlayerState, mode: AutoPurchaseMode): AutoPurchaseMode {
    player.automation.autoPurchaseMode = mode
    return player.automation.autoPurchaseMode
  }

  toggleAutoSell(player: PlayerState): boolean {
    player.automation.autoSellEnabled = !player.automation.autoSellEnabled
    return player.automation.autoSellEnabled
  }

  setSellReserve(player: PlayerState, reserve: number): number {
    player.automation.sellReserve = Math.max(0, Math.min(9, reserve))
    return player.automation.sellReserve
  }

  runAutoProduction(
    player: PlayerState,
    currentMinute: number,
    productionSystem: ProductionSystem,
    resourceSystem: ResourceSystem,
    economySystem: EconomySystem,
    speedMultiplier: number,
  ): {
    startedProductId?: ResourceId
    purchased?: Array<{ resourceId: ResourceId; amount: number; totalCost: number }>
  } {
    if (!player.automation.autoProductionEnabled || player.activeProduction || !player.automation.targetProductId) {
      return {}
    }

    const plan = this.resolveAutomationPlan(player, player.automation.targetProductId)
    const purchased = this.tryAutoPurchase(player, currentMinute, plan.rawNeeds, resourceSystem, economySystem)
    const nextProductId = this.resolveAutomationPlan(player, player.automation.targetProductId).nextProductId
    if (!nextProductId) {
      return purchased.length > 0 ? { purchased } : {}
    }

    const result = productionSystem.startCraft(player, nextProductId, speedMultiplier)
    if (!result.ok) {
      return purchased.length > 0 ? { purchased } : {}
    }

    return { startedProductId: nextProductId, purchased }
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

  importState(lastAutoSellMinute: number, lastAutoPurchaseMinute = 0): void {
    this.lastAutoSellMinute = lastAutoSellMinute
    this.lastAutoPurchaseMinute = lastAutoPurchaseMinute
  }

  exportState(): { lastAutoSellMinute: number; lastAutoPurchaseMinute: number } {
    return {
      lastAutoSellMinute: this.lastAutoSellMinute,
      lastAutoPurchaseMinute: this.lastAutoPurchaseMinute,
    }
  }

  private resolveAutomationPlan(
    player: PlayerState,
    targetProductId: ResourceId,
  ): { nextProductId: ResourceId | null; rawNeeds: Partial<Record<ResourceId, number>> } {
    const product = productConfig[targetProductId]
    if (!product || product.stage === 'raw' || !player.unlockedProducts.includes(targetProductId)) {
      return { nextProductId: null, rawNeeds: {} }
    }

    for (const input of product.inputs) {
      if (player.resources[input.resourceId] >= input.amount) {
        continue
      }

      const inputProduct = productConfig[input.resourceId]
      if (inputProduct.stage === 'raw') {
        return {
          nextProductId: null,
          rawNeeds: {
            [input.resourceId]: input.amount - player.resources[input.resourceId],
          },
        }
      }

      const nestedPlan = this.resolveAutomationPlan(player, input.resourceId)
      if (nestedPlan.nextProductId || Object.keys(nestedPlan.rawNeeds).length > 0) {
        return nestedPlan
      }

      return { nextProductId: input.resourceId, rawNeeds: {} }
    }

    return { nextProductId: targetProductId, rawNeeds: {} }
  }

  private tryAutoPurchase(
    player: PlayerState,
    currentMinute: number,
    rawNeeds: Partial<Record<ResourceId, number>>,
    resourceSystem: ResourceSystem,
    economySystem: EconomySystem,
  ): Array<{ resourceId: ResourceId; amount: number; totalCost: number }> {
    if (!player.automation.autoPurchaseEnabled) {
      return []
    }

    if (currentMinute - this.lastAutoPurchaseMinute < automationConfig.autoPurchaseEveryMinutes) {
      return []
    }

    const purchases: Array<{ resourceId: ResourceId; amount: number; totalCost: number }> = []

    Object.entries(rawNeeds).forEach(([resourceId, amount]) => {
      if (!amount || amount <= 0) {
        return
      }

      const typedResourceId = resourceId as ResourceId
      const batchSize =
        automationConfig.purchaseBatchSize[typedResourceId as keyof typeof automationConfig.purchaseBatchSize] ?? 1
      const desiredAmount = this.getDesiredPurchaseAmount(player, typedResourceId, amount, batchSize)
      const capacityLeft = resourceSystem.getCapacity(player, typedResourceId) - player.resources[typedResourceId]
      const cappedAmount = Math.min(desiredAmount, capacityLeft)
      const finalAmount = cappedAmount - (cappedAmount % batchSize || 0)

      if (finalAmount <= 0) {
        return
      }

      const result = economySystem.buyRawMaterial(
        player,
        typedResourceId,
        finalAmount,
        () => resourceSystem.hasStorageSpace(player, typedResourceId, finalAmount),
      )

      if (!result.ok || result.totalCost === undefined) {
        return
      }

      resourceSystem.addResource(player, typedResourceId, finalAmount)
      purchases.push({
        resourceId: typedResourceId,
        amount: finalAmount,
        totalCost: result.totalCost,
      })
    })

    if (purchases.length > 0) {
      this.lastAutoPurchaseMinute = currentMinute
    }

    return purchases
  }

  private getDesiredPurchaseAmount(
    player: PlayerState,
    resourceId: ResourceId,
    shortageAmount: number,
    batchSize: number,
  ): number {
    const roundedShortage = Math.ceil(shortageAmount / batchSize) * batchSize
    const safetyStock =
      automationConfig.purchaseSafetyStock[player.automation.autoPurchaseMode][
        resourceId as keyof (typeof automationConfig.purchaseSafetyStock)['deficit']
      ] ?? 0
    const desiredInventory = shortageAmount + safetyStock
    const inventoryGap = Math.max(0, desiredInventory - player.resources[resourceId])
    const roundedInventoryGap = Math.ceil(inventoryGap / batchSize) * batchSize

    return Math.max(roundedShortage, roundedInventoryGap)
  }
}
