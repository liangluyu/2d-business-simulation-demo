import { GameLoop } from '../core/GameLoop'
import { TimeSystem, type TimeSnapshot } from '../core/TimeSystem'
import { employeeConfig } from '../config/employeeConfig'
import { productConfig, craftableProductIds } from '../config/productConfig'
import { upgradeConfig, type UpgradeId } from '../config/upgradeConfig'
import type { MarketTrend } from '../models/Market'
import type { Order } from '../models/Order'
import type { PlayerState } from '../models/PlayerState'
import type { ResourceId } from '../models/Resource'
import { AutomationSystem } from '../systems/AutomationSystem'
import { EconomySystem } from '../systems/EconomySystem'
import { EmployeeSystem } from '../systems/EmployeeSystem'
import { MarketSystem } from '../systems/MarketSystem'
import { OrderSystem } from '../systems/OrderSystem'
import { ProductionSystem } from '../systems/ProductionSystem'
import { ResourceSystem } from '../systems/ResourceSystem'
import { SaveSystem } from '../systems/SaveSystem'

export interface ResourceView {
  id: ResourceId
  name: string
  amount: number
  capacity: number
  stage: 'raw' | 'intermediate' | 'finished'
}

export interface UpgradeView {
  id: UpgradeId
  name: string
  description: string
  level: number
  maxLevel: number
  cost: number | null
}

export interface ProductView {
  id: ResourceId
  name: string
  description: string
  stage: 'raw' | 'intermediate' | 'finished'
  durationMinutes: number
  unlocked: boolean
  inputs: string
}

export interface EmployeeView {
  id: 'artisan' | 'merchant'
  name: string
  description: string
  count: number
  hireCost: number
  maxCount: number
}

export interface MarketView {
  productId: ResourceId
  name: string
  unitPrice: number
  trend: MarketTrend
  multiplier: number
  history: number[]
}

export interface GameViewState {
  time: TimeSnapshot
  gold: number
  saveStatus: string
  resources: ResourceView[]
  orders: Array<Order & { remainingMinutes: number }>
  upgrades: UpgradeView[]
  products: ProductView[]
  employees: EmployeeView[]
  market: MarketView[]
  production: {
    active: boolean
    label: string
    progress: number
  }
  automation: {
    autoProductionEnabled: boolean
    autoSellEnabled: boolean
    targetProductId: ResourceId | null
    sellReserve: number
  }
  logs: string[]
}

export class WorkshopGame {
  private readonly onUpdate: (state: GameViewState) => void
  private readonly timeSystem = new TimeSystem()
  private readonly resourceSystem = new ResourceSystem()
  private readonly productionSystem = new ProductionSystem(this.resourceSystem)
  private readonly marketSystem = new MarketSystem(this.resourceSystem)
  private readonly orderSystem = new OrderSystem(this.resourceSystem)
  private readonly economySystem = new EconomySystem()
  private readonly employeeSystem = new EmployeeSystem()
  private readonly automationSystem = new AutomationSystem()
  private readonly saveSystem = new SaveSystem()
  private readonly gameLoop = new GameLoop(500, () => this.tick())
  private readonly tickMinutes = 10
  private readonly logs: string[] = []
  private saveStatus = '未保存'
  private readonly player: PlayerState = {
    gold: 120,
    resources: this.resourceSystem.createInitialResources(),
    upgrades: {
      workshopTools: 0,
      salesmanship: 0,
      storage: 0,
      metalworking: 0,
      engineering: 0,
    },
    unlockedProducts: ['plank'],
    activeProduction: null,
    automation: {
      autoProductionEnabled: false,
      autoSellEnabled: false,
      targetProductId: 'plank',
      sellReserve: 2,
    },
    employees: {
      artisan: 0,
      merchant: 0,
    },
  }

  constructor(onUpdate: (state: GameViewState) => void) {
    this.onUpdate = onUpdate
    if (!this.loadGame()) {
      const now = this.timeSystem.getSnapshot().totalMinutes
      this.marketSystem.initialize(now)
      this.orderSystem.initialize(now, this.player.unlockedProducts, (productId) => this.getMarketOrderPrice(productId))
      this.pushLog('工坊开张：先用木板订单建立现金流，再考虑自动化和员工扩张。')
      this.persist()
    }
  }

  start(): void {
    this.emit()
    this.gameLoop.start()
  }

  buyMaterial(resourceId: ResourceId, amount: number): void {
    const result = this.economySystem.buyRawMaterial(
      this.player,
      resourceId,
      amount,
      () => this.resourceSystem.hasStorageSpace(this.player, resourceId, amount),
    )

    if (!result.ok || result.totalCost === undefined) {
      this.pushLog(result.reason ?? '采购失败。')
      this.emitAndSave()
      return
    }

    this.resourceSystem.addResource(this.player, resourceId, amount)
    this.pushLog(`采购 ${amount} 单位${this.getResourceName(resourceId)}，花费 ${result.totalCost} 金币。`)
    this.emitAndSave()
  }

  startProduction(productId: ResourceId): void {
    const result = this.productionSystem.startCraft(this.player, productId, this.getProductionSpeedMultiplier())
    if (!result.ok || result.totalMinutes === undefined) {
      this.pushLog(result.reason ?? '生产失败。')
      this.emitAndSave()
      return
    }

    this.pushLog(`开始制作${this.getResourceName(productId)}，预计耗时 ${result.totalMinutes} 分钟。`)
    this.emitAndSave()
  }

  fulfillOrder(orderId: string): void {
    const result = this.orderSystem.fulfillOrder(this.player, orderId, this.timeSystem.getSnapshot().totalMinutes)
    if (!result.ok || result.reward === undefined) {
      this.pushLog(result.reason ?? '订单交付失败。')
      this.emitAndSave()
      return
    }

    const bonusMultiplier = 1 + this.player.upgrades.salesmanship * 0.1
    const bonus = Math.round(result.reward * (bonusMultiplier - 1))
    if (bonus > 0) {
      this.player.gold += bonus
    }

    this.pushLog(`订单完成，获得 ${result.reward + bonus} 金币。`)
    this.emitAndSave()
  }

  sellToMarket(productId: ResourceId, quantity: number): void {
    const result = this.marketSystem.sellProduct(
      this.player,
      productId,
      quantity,
      this.employeeSystem.getMarketSalesBonus(this.player),
    )

    if (!result.ok || result.revenue === undefined) {
      this.pushLog(result.reason ?? '出售失败。')
      this.emitAndSave()
      return
    }

    this.pushLog(`出售 ${quantity} 单位${this.getResourceName(productId)}，收入 ${result.revenue} 金币。`)
    this.emitAndSave()
  }

  buyUpgrade(upgradeId: UpgradeId): void {
    const result = this.economySystem.buyUpgrade(this.player, upgradeId)
    if (!result.ok) {
      this.pushLog(result.reason ?? '升级失败。')
      this.emitAndSave()
      return
    }

    if (upgradeId === 'metalworking' && !this.player.unlockedProducts.includes('metalParts')) {
      this.player.unlockedProducts.push('metalParts')
    }

    if (upgradeId === 'engineering' && !this.player.unlockedProducts.includes('toolkit')) {
      this.player.unlockedProducts.push('toolkit')
    }

    const upgradeName = upgradeConfig.find((item) => item.id === upgradeId)?.name ?? upgradeId
    this.pushLog(`完成升级【${upgradeName}】。`)
    this.emitAndSave()
  }

  hireEmployee(employeeId: 'artisan' | 'merchant'): void {
    const result = this.employeeSystem.hire(this.player, employeeId)
    if (!result.ok || result.cost === undefined) {
      this.pushLog(result.reason ?? '雇佣失败。')
      this.emitAndSave()
      return
    }

    const employeeName = employeeConfig.find((item) => item.id === employeeId)?.name ?? employeeId
    this.pushLog(`雇佣 ${employeeName} 1 名，花费 ${result.cost} 金币。`)
    this.emitAndSave()
  }

  toggleAutoProduction(): void {
    const enabled = this.automationSystem.toggleAutoProduction(this.player)
    this.pushLog(`自动生产已${enabled ? '开启' : '关闭'}。`)
    this.emitAndSave()
  }

  toggleAutoSell(): void {
    const enabled = this.automationSystem.toggleAutoSell(this.player)
    this.pushLog(`自动销售已${enabled ? '开启' : '关闭'}。`)
    this.emitAndSave()
  }

  setAutoProduct(productId: ResourceId): void {
    this.automationSystem.setTargetProduct(this.player, productId)
    this.pushLog(`自动生产目标已切换为 ${this.getResourceName(productId)}。`)
    this.emitAndSave()
  }

  adjustSellReserve(delta: number): void {
    const reserve = this.automationSystem.setSellReserve(this.player, this.player.automation.sellReserve + delta)
    this.pushLog(`自动销售保留库存调整为 ${reserve}。`)
    this.emitAndSave()
  }

  private tick(): void {
    const previousTime = this.timeSystem.getSnapshot()
    const time = this.timeSystem.advance(this.tickMinutes)
    const production = this.productionSystem.tick(this.player, this.tickMinutes)

    if (production.completedProductId) {
      this.pushLog(`${this.getResourceName(production.completedProductId)} 制作完成，已入库。`)
    }

    const autoStarted = this.automationSystem.runAutoProduction(this.player, this.productionSystem)
    if (autoStarted.startedProductId) {
      this.pushLog(`自动生产启动：${this.getResourceName(autoStarted.startedProductId)}。`)
    }

    const marketChanged = this.marketSystem.tick(time.totalMinutes)
    if (marketChanged) {
      this.pushLog('市场价格波动：留意高价时机与自动销售收益。')
    }

    const sales = this.automationSystem.runAutoSell(
      this.player,
      time.totalMinutes,
      this.marketSystem,
      this.employeeSystem.getMarketSalesBonus(this.player),
    )
    sales.forEach((sale) => {
      this.pushLog(`自动销售：${this.getResourceName(sale.productId)} x${sale.quantity}，收入 ${sale.revenue} 金币。`)
    })

    const refreshed = this.orderSystem.refreshIfNeeded(
      time.totalMinutes,
      this.player.unlockedProducts,
      (productId) => this.getMarketOrderPrice(productId),
    )
    if (refreshed) {
      this.pushLog('市场订单刷新，当前市场价会影响新订单报价。')
    }

    if (previousTime.day !== time.day) {
      const wages = this.employeeSystem.collectDailyWages(this.player)
      if (wages.total > 0) {
        this.pushLog(`支付员工日薪 ${wages.total} 金币。${wages.breakdown.join('，')}`)
      }

      this.pushLog(`第 ${time.day} 天开始：检查自动化目标、库存与市场价格。`)
    }

    this.emitAndSave()
  }

  private loadGame(): boolean {
    const save = this.saveSystem.load()
    if (!save) {
      return false
    }

    this.timeSystem.setTotalMinutes(save.totalMinutes)
    this.player.gold = save.player.gold
    this.player.resources = save.player.resources
    this.player.upgrades = save.player.upgrades
    this.player.unlockedProducts = save.player.unlockedProducts
    this.player.activeProduction = save.player.activeProduction
    this.player.automation = save.player.automation
    this.player.employees = save.player.employees
    this.logs.splice(0, this.logs.length, ...save.logs)
    this.orderSystem.importState(save.orders, save.nextOrderRefreshAt)
    this.marketSystem.importState(save.market)
    this.automationSystem.importState(save.automationMeta.lastAutoSellMinute)
    this.saveStatus = `已载入 ${new Date(save.savedAt).toLocaleString()}`
    this.pushLog('读取本地存档成功。')
    return true
  }

  private persist(): void {
    this.saveSystem.save({
      version: 1,
      savedAt: new Date().toISOString(),
      totalMinutes: this.timeSystem.getSnapshot().totalMinutes,
      player: structuredClone(this.player),
      orders: this.orderSystem.exportState().orders,
      nextOrderRefreshAt: this.orderSystem.exportState().nextRefreshAt,
      market: this.marketSystem.exportState(),
      logs: [...this.logs],
      automationMeta: this.automationSystem.exportState(),
    })
    this.saveStatus = `已保存 ${new Date().toLocaleTimeString()}`
  }

  private emitAndSave(): void {
    this.persist()
    this.emit()
  }

  private emit(): void {
    const currentTime = this.timeSystem.getSnapshot()

    this.onUpdate({
      time: currentTime,
      gold: this.player.gold,
      saveStatus: this.saveStatus,
      resources: Object.entries(this.player.resources).map(([id, amount]) => ({
        id: id as ResourceId,
        name: this.getResourceName(id as ResourceId),
        amount,
        capacity: this.resourceSystem.getCapacity(this.player, id as ResourceId),
        stage: productConfig[id as ResourceId].stage,
      })),
      orders: this.orderSystem.getOrders(currentTime.totalMinutes).map((order) => ({
        ...order,
        remainingMinutes: order.expiresAtMinute - currentTime.totalMinutes,
      })),
      upgrades: upgradeConfig.map((upgrade) => ({
        id: upgrade.id,
        name: upgrade.name,
        description: upgrade.description,
        level: this.player.upgrades[upgrade.id],
        maxLevel: upgrade.maxLevel,
        cost: this.economySystem.getUpgradeCost(this.player, upgrade.id),
      })),
      products: craftableProductIds.map((productId) => ({
        id: productId,
        name: this.getResourceName(productId),
        description: productConfig[productId].description,
        stage: productConfig[productId].stage,
        durationMinutes: this.getAdjustedCraftMinutes(productId),
        unlocked: this.player.unlockedProducts.includes(productId),
        inputs: productConfig[productId].inputs
          .map((input) => `${input.amount} ${this.getResourceName(input.resourceId)}`)
          .join(' + '),
      })),
      employees: employeeConfig.map((employee) => ({
        id: employee.id,
        name: employee.name,
        description: employee.description,
        count: this.player.employees[employee.id],
        hireCost: employee.hireCost,
        maxCount: employee.maxCount,
      })),
      market: this.marketSystem.getSnapshot().products.map((product) => ({
        productId: product.productId,
        name: this.getResourceName(product.productId),
        unitPrice: product.unitPrice,
        trend: product.trend,
        multiplier: product.multiplier,
        history: product.history,
      })),
      production: this.getProductionView(),
      automation: { ...this.player.automation },
      logs: [...this.logs],
    })
  }

  private getProductionView(): GameViewState['production'] {
    if (!this.player.activeProduction) {
      return {
        active: false,
        label: '工坊空闲，可手动安排，也可交给自动生产规划。',
        progress: 0,
      }
    }

    const active = this.player.activeProduction
    return {
      active: true,
      label: `正在制作 ${this.getResourceName(active.productId)}`,
      progress: Math.min(100, Math.round((active.progressMinutes / active.totalMinutes) * 100)),
    }
  }

  private getAdjustedCraftMinutes(productId: ResourceId): number {
    const base = productConfig[productId].craftMinutes
    return Math.max(20, Math.round(base / this.getProductionSpeedMultiplier()))
  }

  private getProductionSpeedMultiplier(): number {
    const upgradeMultiplier = Math.max(1, 1 + this.player.upgrades.workshopTools * 0.12)
    const employeeMultiplier = this.employeeSystem.getProductionSpeedBonus(this.player)
    return upgradeMultiplier * employeeMultiplier
  }

  private getMarketOrderPrice(productId: ResourceId): number {
    const marketPrice = this.marketSystem.getProductMarket(productId)?.unitPrice ?? productConfig[productId].suggestedPrice
    return Math.max(productConfig[productId].suggestedPrice, marketPrice)
  }

  private getResourceName(resourceId: ResourceId): string {
    return productConfig[resourceId]?.name ?? resourceId
  }

  private pushLog(message: string): void {
    const time = this.timeSystem.getSnapshot()
    this.logs.unshift(`[D${time.day} ${this.formatTime(time)}] ${message}`)
    this.logs.splice(10)
  }

  private formatTime(time: TimeSnapshot): string {
    return `${String(time.hour).padStart(2, '0')}:${String(time.minute).padStart(2, '0')}`
  }
}
