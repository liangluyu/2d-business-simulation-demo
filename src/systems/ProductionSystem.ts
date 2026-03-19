import { productConfig } from '../config/productConfig'
import type { PlayerState } from '../models/PlayerState'
import type { ResourceId } from '../models/Resource'
import { ResourceSystem } from './ResourceSystem'

export class ProductionSystem {
  private readonly resourceSystem: ResourceSystem

  constructor(resourceSystem: ResourceSystem) {
    this.resourceSystem = resourceSystem
  }

  canCraft(player: PlayerState, productId: ResourceId): { ok: boolean; reason?: string } {
    const product = productConfig[productId]

    if (!product || product.outputAmount === 0) {
      return { ok: false, reason: '该资源不可生产。' }
    }

    if (!player.unlockedProducts.includes(productId)) {
      return { ok: false, reason: '该工序尚未解锁。' }
    }

    if (player.activeProduction) {
      return { ok: false, reason: '工坊正在忙碌中。' }
    }

    const hasInputs = product.inputs.every((input) => player.resources[input.resourceId] >= input.amount)
    if (!hasInputs) {
      return { ok: false, reason: '原料不足，无法开工。' }
    }

    if (!this.resourceSystem.hasStorageSpace(player, productId, product.outputAmount)) {
      return { ok: false, reason: '成品仓位不足。' }
    }

    return { ok: true }
  }

  startCraft(
    player: PlayerState,
    productId: ResourceId,
    speedMultiplier = 1,
  ): { ok: boolean; reason?: string; totalMinutes?: number } {
    const validation = this.canCraft(player, productId)
    if (!validation.ok) {
      return validation
    }

    const product = productConfig[productId]
    const spent = this.resourceSystem.spendResources(
      player,
      Object.fromEntries(product.inputs.map((input) => [input.resourceId, input.amount])),
    )

    if (!spent) {
      return { ok: false, reason: '扣除原料失败。' }
    }

    const totalMinutes = Math.max(20, Math.round(product.craftMinutes / Math.max(0.2, speedMultiplier)))

    player.activeProduction = {
      productId,
      progressMinutes: 0,
      totalMinutes,
    }

    return { ok: true, totalMinutes }
  }

  tick(player: PlayerState, minutes: number): { completedProductId?: ResourceId } {
    if (!player.activeProduction) {
      return {}
    }

    player.activeProduction.progressMinutes += minutes
    if (player.activeProduction.progressMinutes < player.activeProduction.totalMinutes) {
      return {}
    }

    const completedProductId = player.activeProduction.productId
    const product = productConfig[completedProductId]
    this.resourceSystem.addResource(player, completedProductId, product.outputAmount)
    player.activeProduction = null

    return { completedProductId }
  }
}
