import { orderBoardConfig, orderClients, orderTemplates } from '../config/orderConfig'
import type { Order } from '../models/Order'
import type { PlayerState } from '../models/PlayerState'
import type { ResourceId } from '../models/Resource'
import { ResourceSystem } from './ResourceSystem'

export class OrderSystem {
  private orders: Order[] = []
  private orderId = 1
  private nextRefreshAt = orderBoardConfig.refreshEveryMinutes
  private readonly resourceSystem: ResourceSystem

  constructor(resourceSystem: ResourceSystem) {
    this.resourceSystem = resourceSystem
  }

  initialize(currentMinute: number, unlockedProducts: ResourceId[], pricing: (productId: ResourceId) => number): void {
    this.nextRefreshAt = currentMinute + orderBoardConfig.refreshEveryMinutes
    this.refresh(currentMinute, unlockedProducts, pricing)
  }

  importState(orders: Order[], nextRefreshAt: number): void {
    this.orders = orders
    this.nextRefreshAt = nextRefreshAt
    this.orderId = Math.max(
      1,
      ...orders.map((order) => Number.parseInt(order.id.replace('ORD-', ''), 10) + 1).filter(Number.isFinite),
    )
  }

  exportState(): { orders: Order[]; nextRefreshAt: number } {
    return {
      orders: [...this.orders],
      nextRefreshAt: this.nextRefreshAt,
    }
  }

  getOrders(currentMinute: number): Order[] {
    return this.orders
      .filter((order) => order.expiresAtMinute > currentMinute)
      .sort((left, right) => left.expiresAtMinute - right.expiresAtMinute)
  }

  refreshIfNeeded(currentMinute: number, unlockedProducts: ResourceId[], pricing: (productId: ResourceId) => number): boolean {
    if (currentMinute < this.nextRefreshAt) {
      this.orders = this.getOrders(currentMinute)
      return false
    }

    this.refresh(currentMinute, unlockedProducts, pricing)
    this.nextRefreshAt = currentMinute + orderBoardConfig.refreshEveryMinutes
    return true
  }

  fulfillOrder(player: PlayerState, orderId: string, currentMinute: number): { ok: boolean; reason?: string; reward?: number } {
    const order = this.orders.find((item) => item.id === orderId)
    if (!order) {
      return { ok: false, reason: '订单已失效。' }
    }

    if (order.expiresAtMinute <= currentMinute) {
      this.orders = this.orders.filter((item) => item.id !== orderId)
      return { ok: false, reason: '订单已过期。' }
    }

    if (!this.resourceSystem.removeResource(player, order.productId, order.quantity)) {
      return { ok: false, reason: '库存不足，无法交付。' }
    }

    this.orders = this.orders.filter((item) => item.id !== orderId)
    return { ok: true, reward: order.rewardGold }
  }

  private refresh(currentMinute: number, unlockedProducts: ResourceId[], pricing: (productId: ResourceId) => number): void {
    const validExisting = this.getOrders(currentMinute)
    const needed = Math.max(0, orderBoardConfig.maxOrders - validExisting.length)
    const count = Math.min(
      needed,
      this.randomInt(orderBoardConfig.minOrdersPerRefresh, orderBoardConfig.maxOrdersPerRefresh),
    )

    const availableTemplates = orderTemplates.filter((template) => unlockedProducts.includes(template.productId))
    const additions = Array.from({ length: count }, () => this.createOrder(currentMinute, availableTemplates, pricing))

    this.orders = [...validExisting, ...additions]
  }

  private createOrder(
    currentMinute: number,
    templates: typeof orderTemplates,
    pricing: (productId: ResourceId) => number,
  ): Order {
    const template = templates[Math.floor(Math.random() * templates.length)]
    const quantity = this.randomInt(template.minQuantity, template.maxQuantity)
    const baseReward = pricing(template.productId) * quantity
    const rewardGold = Math.round(baseReward * template.baseMultiplier)
    const expiresAtMinute = currentMinute + this.randomInt(template.minExpireMinutes, template.maxExpireMinutes)

    return {
      id: `ORD-${this.orderId++}`,
      clientName: orderClients[Math.floor(Math.random() * orderClients.length)],
      productId: template.productId,
      quantity,
      rewardGold,
      expiresAtMinute,
      risk: template.risk,
      createdAtMinute: currentMinute,
    }
  }

  private randomInt(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min
  }
}
