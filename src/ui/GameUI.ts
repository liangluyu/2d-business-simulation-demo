import { productConfig } from '../config/productConfig'
import { resourceConfig } from '../config/resourceConfig'
import type { UpgradeId } from '../config/upgradeConfig'
import type { GameViewState, WorkshopGame } from '../game/WorkshopGame'
import type { ResourceId } from '../models/Resource'

export class GameUI {
  private previousResourceValues = new Map<string, number>()
  private lastState: GameViewState | null = null
  private selectedProductId: ResourceId | null = null
  private selectedOrderId: string | null = null
  private selectedMarketProductId: ResourceId | null = null
  private utilityPanel: 'employees' | 'upgrades' | null = null
  private orderFilter: 'all' | 'rush' | 'premium' | 'stable' = 'all'
  private orderSort: 'time' | 'reward' = 'time'
  private orderDensity: 'compact' | 'expanded' = 'compact'
  private readonly root: HTMLElement
  private readonly game: WorkshopGame

  constructor(root: HTMLElement, game: WorkshopGame) {
    this.root = root
    this.game = game
  }

  render(state: GameViewState): void {
    this.lastState = state
    const selectedProduct = this.getSelectedProduct(state)
    const visibleOrders = this.getVisibleOrders(state)
    const selectedOrder = this.getSelectedOrder(visibleOrders)
    const selectedMarket = this.getSelectedMarket(state)
    const suggestedProductId = this.getSuggestedProductId(selectedOrder, selectedMarket, state)

    this.root.innerHTML = `
      <div class="shell dashboard-shell">
        <header class="topbar compact-topbar">
          <div class="brand-block compact-brand">
            <p class="eyebrow">Small Workshop Simulator</p>
            <h1>山镇工坊经营</h1>
            <p class="hero-copy">一屏管理排产、订单、市场与自动化。</p>
          </div>
          <div class="topbar-stats compact-stats">
            <div class="headline-card"><span>金币</span><strong>${state.gold}</strong></div>
            <div class="headline-card"><span>日期</span><strong>第 ${state.time.day} 天</strong></div>
            <div class="headline-card"><span>时间</span><strong>${this.formatClock(state.time.hour, state.time.minute)}</strong></div>
            <div class="headline-card"><span>存档</span><strong class="save-status">${state.saveStatus}</strong></div>
          </div>
        </header>

        <main class="dashboard-grid">
          <section class="panel column-panel">
            <div class="panel-header compact">
              <div><p class="panel-kicker">Inventory</p><h2>库存与采购</h2></div>
              <span class="pill">运营清单</span>
            </div>
            <div class="inventory-table operations-table">
              <div class="inventory-head"><span>阶段</span><span>资源</span><span>库存</span><span>缺口</span></div>
              <div class="inventory-body scroll-list">
                ${state.resources.map((resource) => this.renderResourceRow(resource.id, resource.name, resource.amount, resource.capacity, resource.stage)).join('')}
              </div>
            </div>
            <div class="purchase-actions compact-actions compact-purchase-bar">
              <button data-buy="wood">木材 +5</button>
              <button data-buy="ore">矿石 +4</button>
            </div>
            <div class="utility-summary utility-summary-thin">
              <article class="summary-card">
                <div><p class="panel-kicker">People</p><h2>员工摘要</h2></div>
                <div class="summary-metrics">
                  <span>工匠 ${state.employees.find((employee) => employee.id === 'artisan')?.count ?? 0}</span>
                  <span>销售 ${state.employees.find((employee) => employee.id === 'merchant')?.count ?? 0}</span>
                </div>
                <button data-utility="employees">员工管理</button>
              </article>
              <article class="summary-card">
                <div><p class="panel-kicker">Upgrades</p><h2>升级摘要</h2></div>
                <div class="summary-metrics">
                  <span>已购 ${state.upgrades.filter((upgrade) => upgrade.level > 0).length}</span>
                  <span>可买 ${state.upgrades.filter((upgrade) => upgrade.cost !== null && upgrade.cost <= state.gold).length}</span>
                </div>
                <button data-utility="upgrades">升级中心</button>
              </article>
            </div>
          </section>

          <section class="panel center-panel">
            <div class="subpanel fixed-subpanel">
              <div class="panel-header compact">
                <div><p class="panel-kicker">Workshop</p><h2>生产排程</h2></div>
                <span class="pill ${state.production.active ? 'busy' : 'idle'}">${state.production.active ? '生产中' : '空闲'}</span>
              </div>
              <div class="production-topline">
                <div class="production-status compact-status">
                  <p>${state.production.label}</p>
                  <div class="progress-track"><div class="progress-fill" style="width: ${state.production.progress}%"></div></div>
                </div>
                ${this.renderStrategyBar(selectedOrder, selectedMarket, suggestedProductId, selectedProduct.id, state)}
                <div class="recipe-tabs">
                  ${state.products.map((product) => `
                    <button class="recipe-tab ${selectedProduct.id === product.id ? 'active' : ''} ${suggestedProductId === product.id ? 'suggested' : ''}" data-select-product="${product.id}">
                      ${product.name}
                    </button>
                  `).join('')}
                </div>
              </div>
              <div class="production-detail-panel">
                ${this.renderProductionHint(suggestedProductId, selectedProduct.id, state)}
                <div class="production-focus">
                <article class="product-card ${selectedProduct.unlocked ? '' : 'locked'} compact-card focus-card">
                  <div>
                    <p class="mini-stage">${this.getStageLabel(selectedProduct.stage)}</p>
                    <h3>${selectedProduct.name}</h3>
                    <p>${selectedProduct.description}</p>
                  </div>
                  <dl>
                    <div><dt>配方</dt><dd>${selectedProduct.inputs}</dd></div>
                    <div><dt>耗时</dt><dd>${selectedProduct.durationMinutes} 分钟</dd></div>
                  </dl>
                  <button data-craft="${selectedProduct.id}" ${selectedProduct.unlocked ? '' : 'disabled'}>
                    ${selectedProduct.unlocked ? `制作 ${selectedProduct.name}` : '等待解锁'}
                  </button>
                </article>
                </div>
              </div>
            </div>

            <div class="subpanel fill-subpanel">
              <div class="panel-header compact">
                <div><p class="panel-kicker">Orders</p><h2>订单看板</h2></div>
                <span class="pill">优先处理高价急单</span>
              </div>
              <div class="order-summary-row">
                <div class="order-snapshot">${this.renderOrderSnapshot(state)}</div>
              </div>
              <div class="toolbar-row order-controls-row">
                <div class="filter-group">
                  <button class="toolbar-chip ${this.orderFilter === 'all' ? 'active' : ''}" data-order-filter="all">全部</button>
                  <button class="toolbar-chip ${this.orderFilter === 'rush' ? 'active' : ''}" data-order-filter="rush">急单</button>
                  <button class="toolbar-chip ${this.orderFilter === 'premium' ? 'active' : ''}" data-order-filter="premium">高收益</button>
                  <button class="toolbar-chip ${this.orderFilter === 'stable' ? 'active' : ''}" data-order-filter="stable">稳定</button>
                </div>
                <div class="filter-group">
                  <button class="toolbar-chip ${this.orderSort === 'time' ? 'active' : ''}" data-order-sort="time">按时间</button>
                  <button class="toolbar-chip ${this.orderSort === 'reward' ? 'active' : ''}" data-order-sort="reward">按报酬</button>
                </div>
                <div class="filter-group">
                  <button class="toolbar-chip ${this.orderDensity === 'compact' ? 'active' : ''}" data-order-density="compact">紧凑列表</button>
                  <button class="toolbar-chip ${this.orderDensity === 'expanded' ? 'active' : ''}" data-order-density="expanded">宽展列表</button>
                </div>
              </div>
              ${selectedOrder ? this.renderOrderFocus(selectedOrder, state) : ''}
              ${selectedOrder ? this.renderExecutionChain(selectedOrder, state, selectedProduct.id) : ''}
              <div class="order-list scroll-list ${this.orderDensity === 'compact' ? 'compact-order-list' : ''}">
                ${visibleOrders.length > 0 ? visibleOrders.map((order) => `
                  ${this.orderDensity === 'compact' ? this.renderCompactOrderCard(order, selectedOrder?.id === order.id) : this.renderExpandedOrderCard(order, selectedOrder?.id === order.id)}
                `).join('') : '<p class="empty-state">当前筛选下没有可处理订单。</p>'}
              </div>
            </div>
          </section>

          <section class="panel right-panel">
            <div class="subpanel">
              <div class="panel-header compact">
                <div><p class="panel-kicker">Trade Console</p><h2>交易控制台</h2></div>
                <span class="pill">卖货与自动化</span>
              </div>
              <div class="trade-console">
                ${selectedMarket ? this.renderMarketFocus(selectedMarket, state) : ''}
                <div class="market-list scroll-list small-scroll">
                  ${state.market.map((entry) => `
                    <article class="market-card trend-${entry.trend} compact-card ${selectedMarket?.productId === entry.productId ? 'selected' : ''}" data-select-market="${entry.productId}">
                      <div>
                        <h3>${entry.name}</h3>
                        <p>${this.getTrendLabel(entry.trend)} · 系数 ${entry.multiplier.toFixed(2)}</p>
                        <div class="sparkline">${this.renderSparkline(entry.history)}</div>
                      </div>
                      <div class="market-actions">
                        <strong>${entry.unitPrice} / 件</strong>
                        <button data-sell="${entry.productId}">卖 1 件</button>
                      </div>
                    </article>
                  `).join('')}
                </div>
                <div class="automation-card compact-card">
                  <div class="toggle-row"><span>自动生产</span><button data-toggle-auto-production>${state.automation.autoProductionEnabled ? '已开启' : '已关闭'}</button></div>
                  <div class="toggle-row"><span>自动销售</span><button data-toggle-auto-sell>${state.automation.autoSellEnabled ? '已开启' : '已关闭'}</button></div>
                  <div class="auto-target-list">
                    ${state.products.filter((product) => product.unlocked).map((product) => `
                      <button class="${state.automation.targetProductId === product.id ? 'selected-target' : ''}" data-auto-target="${product.id}">
                        ${product.name}
                      </button>
                    `).join('')}
                  </div>
                  <div class="reserve-row">
                    <span>保留库存</span>
                    <div class="reserve-actions"><button data-reserve="-1">-</button><strong>${state.automation.sellReserve}</strong><button data-reserve="1">+</button></div>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </main>

        <footer class="statusbar">
          <div class="status-chip">生产目标：${state.automation.targetProductId ? this.getResourceName(state.automation.targetProductId) : '未设置'}</div>
          <div class="status-chip">自动生产：${state.automation.autoProductionEnabled ? '开' : '关'}</div>
          <div class="status-chip">自动销售：${state.automation.autoSellEnabled ? '开' : '关'}</div>
          <div class="status-chip">订单数：${state.orders.length}</div>
          <div class="status-chip">市场最高价：${this.getBestMarketLine(state)}</div>
        </footer>

        ${this.renderUtilityDrawer(state)}
        ${this.renderFloatingFeed(state)}
      </div>
    `

    this.bindEvents()
    this.animateResourceChanges(state)
  }

  private bindEvents(): void {
    this.root.querySelectorAll<HTMLButtonElement>('[data-buy]').forEach((button) => {
      button.onclick = () => {
        const resourceId = button.dataset.buy as ResourceId
        const amount = resourceId === 'wood' ? 5 : 4
        this.game.buyMaterial(resourceId, amount)
      }
    })

    this.root.querySelectorAll<HTMLButtonElement>('[data-craft]').forEach((button) => {
      button.onclick = () => {
        const productId = button.dataset.craft as ResourceId
        this.game.startProduction(productId)
      }
    })

    this.root.querySelectorAll<HTMLButtonElement>('[data-order]').forEach((button) => {
      button.onclick = (event) => {
        event.stopPropagation()
        const orderId = button.dataset.order
        if (orderId) {
          this.game.fulfillOrder(orderId)
        }
      }
    })

    this.root.querySelectorAll<HTMLElement>('[data-select-order]').forEach((card) => {
      card.onclick = () => {
        const orderId = card.dataset.selectOrder
        if (orderId) {
          this.selectedOrderId = orderId
          this.renderLastState()
        }
      }
    })

    this.root.querySelectorAll<HTMLButtonElement>('[data-select-order-button]').forEach((button) => {
      button.onclick = (event) => {
        event.stopPropagation()
        const orderId = button.dataset.selectOrderButton
        if (orderId) {
          this.selectedOrderId = orderId
          this.renderLastState()
        }
      }
    })

    this.root.querySelectorAll<HTMLElement>('[data-select-market]').forEach((card) => {
      card.onclick = () => {
        const productId = card.dataset.selectMarket as ResourceId | undefined
        if (productId) {
          this.selectedMarketProductId = productId
          this.renderLastState()
        }
      }
    })

    this.root.querySelectorAll<HTMLButtonElement>('[data-upgrade]').forEach((button) => {
      button.onclick = () => {
        const upgradeId = button.dataset.upgrade as UpgradeId
        this.game.buyUpgrade(upgradeId)
      }
    })

    this.root.querySelectorAll<HTMLButtonElement>('[data-hire]').forEach((button) => {
      button.onclick = () => {
        const employeeId = button.dataset.hire as 'artisan' | 'merchant'
        this.game.hireEmployee(employeeId)
      }
    })

    this.root.querySelectorAll<HTMLButtonElement>('[data-sell]').forEach((button) => {
      button.onclick = (event) => {
        event.stopPropagation()
        const productId = button.dataset.sell as ResourceId
        this.game.sellToMarket(productId, 1)
      }
    })

    this.root.querySelectorAll<HTMLButtonElement>('[data-toggle-auto-production]').forEach((button) => {
      button.onclick = () => this.game.toggleAutoProduction()
    })

    this.root.querySelectorAll<HTMLButtonElement>('[data-toggle-auto-sell]').forEach((button) => {
      button.onclick = () => this.game.toggleAutoSell()
    })

    this.root.querySelectorAll<HTMLButtonElement>('[data-auto-target]').forEach((button) => {
      button.onclick = () => {
        const productId = button.dataset.autoTarget as ResourceId
        this.game.setAutoProduct(productId)
      }
    })

    this.root.querySelectorAll<HTMLButtonElement>('[data-adopt-market-target]').forEach((button) => {
      button.onclick = () => {
        const productId = button.dataset.adoptMarketTarget as ResourceId | undefined
        if (productId) {
          this.game.setAutoProduct(productId)
        }
      }
    })

    this.root.querySelectorAll<HTMLButtonElement>('[data-reserve]').forEach((button) => {
      button.onclick = () => {
        const delta = Number(button.dataset.reserve)
        this.game.adjustSellReserve(delta)
      }
    })

    this.root.querySelectorAll<HTMLButtonElement>('[data-select-product]').forEach((button) => {
      button.onclick = () => {
        this.selectedProductId = button.dataset.selectProduct as ResourceId
        this.renderLastState()
      }
    })

    this.root.querySelectorAll<HTMLButtonElement>('[data-gap-buy]').forEach((button) => {
      button.onclick = () => {
        const resourceId = button.dataset.gapBuy as ResourceId | undefined
        if (resourceId) {
          const amount = resourceId === 'wood' ? 5 : resourceId === 'ore' ? 4 : 1
          this.game.buyMaterial(resourceId, amount)
        }
      }
    })

    this.root.querySelectorAll<HTMLButtonElement>('[data-gap-focus-product]').forEach((button) => {
      button.onclick = () => {
        const productId = button.dataset.gapFocusProduct as ResourceId | undefined
        if (productId) {
          this.selectedProductId = productId
          this.renderLastState()
        }
      }
    })

    this.root.querySelectorAll<HTMLButtonElement>('[data-apply-suggested-product]').forEach((button) => {
      button.onclick = () => {
        const productId = button.dataset.applySuggestedProduct as ResourceId | undefined
        if (productId) {
          this.selectedProductId = productId
          this.renderLastState()
        }
      }
    })

    this.root.querySelectorAll<HTMLButtonElement>('[data-focus-market]').forEach((button) => {
      button.onclick = () => {
        const productId = button.dataset.focusMarket as ResourceId | undefined
        if (productId) {
          this.selectedMarketProductId = productId
          this.renderLastState()
        }
      }
    })

    this.root.querySelectorAll<HTMLButtonElement>('[data-focus-order-product]').forEach((button) => {
      button.onclick = () => {
        const productId = button.dataset.focusOrderProduct as ResourceId | undefined
        if (productId) {
          this.selectedProductId = productId
          this.renderLastState()
        }
      }
    })

    this.root.querySelectorAll<HTMLButtonElement>('[data-order-filter]').forEach((button) => {
      button.onclick = () => {
        this.orderFilter = button.dataset.orderFilter as typeof this.orderFilter
        this.renderLastState()
      }
    })

    this.root.querySelectorAll<HTMLButtonElement>('[data-order-sort]').forEach((button) => {
      button.onclick = () => {
        this.orderSort = button.dataset.orderSort as typeof this.orderSort
        this.renderLastState()
      }
    })

    this.root.querySelectorAll<HTMLButtonElement>('[data-order-density]').forEach((button) => {
      button.onclick = () => {
        this.orderDensity = button.dataset.orderDensity as typeof this.orderDensity
        this.renderLastState()
      }
    })

    this.root.querySelectorAll<HTMLButtonElement>('[data-utility]').forEach((button) => {
      button.onclick = () => {
        this.utilityPanel = button.dataset.utility as 'employees' | 'upgrades'
        this.renderLastState()
      }
    })

    this.root.querySelectorAll<HTMLButtonElement>('[data-close-utility]').forEach((button) => {
      button.onclick = () => {
        this.utilityPanel = null
        this.renderLastState()
      }
    })
  }

  private renderLastState(): void {
    if (this.lastState) {
      this.render(this.lastState)
    }
  }

  private animateResourceChanges(state: GameViewState): void {
    state.resources.forEach((resource) => {
      const previous = this.previousResourceValues.get(resource.id)
      const card = this.root.querySelector<HTMLElement>(`[data-resource-card="${resource.id}"]`)

      if (card && previous !== undefined && previous !== resource.amount) {
        card.classList.remove('gain', 'loss')
        void card.offsetWidth
        card.classList.add(resource.amount > previous ? 'gain' : 'loss')
      }

      this.previousResourceValues.set(resource.id, resource.amount)
    })
  }

  private renderResourceRow(
    id: ResourceId,
    name: string,
    amount: number,
    capacity: number,
    stage: 'raw' | 'intermediate' | 'finished',
  ): string {
    const ratio = Math.min(100, Math.round((amount / capacity) * 100))
    return `
      <article class="inventory-row resource-card compact-card" data-resource-card="${id}">
        <span class="mini-stage">${this.getStageLabel(stage)}</span>
        <div class="inventory-name">
          <h3>${name}</h3>
          <div class="capacity-track"><div class="capacity-fill" style="width: ${ratio}%"></div></div>
        </div>
        <strong>${amount}/${capacity}</strong>
        <p>${this.getResourceGapText(amount, capacity, id)}</p>
      </article>
    `
  }

  private getSelectedProduct(state: GameViewState): GameViewState['products'][number] {
    const unlocked = state.products.filter((product) => product.unlocked)
    const fallback = unlocked[0] ?? state.products[0]

    if (!this.selectedProductId) {
      this.selectedProductId = fallback.id
      return fallback
    }

    const selected = state.products.find((product) => product.id === this.selectedProductId)
    if (!selected) {
      this.selectedProductId = fallback.id
      return fallback
    }

    return selected
  }

  private getVisibleOrders(state: GameViewState): GameViewState['orders'] {
    const filtered = state.orders.filter((order) => this.orderFilter === 'all' || order.risk === this.orderFilter)

    return filtered.sort((left, right) => {
      if (this.orderSort === 'reward') {
        return right.rewardGold - left.rewardGold
      }

      return left.remainingMinutes - right.remainingMinutes
    })
  }

  private getSelectedOrder(orders: GameViewState['orders']): GameViewState['orders'][number] | null {
    const fallback = orders[0] ?? null

    if (!fallback) {
      this.selectedOrderId = null
      return null
    }

    if (!this.selectedOrderId) {
      this.selectedOrderId = fallback.id
      return fallback
    }

    const selected = orders.find((order) => order.id === this.selectedOrderId)
    if (!selected) {
      this.selectedOrderId = fallback.id
      return fallback
    }

    return selected
  }

  private getSelectedMarket(state: GameViewState): GameViewState['market'][number] | null {
    const fallback = [...state.market].sort((left, right) => right.unitPrice - left.unitPrice)[0] ?? state.market[0] ?? null

    if (!fallback) {
      this.selectedMarketProductId = null
      return null
    }

    if (!this.selectedMarketProductId) {
      this.selectedMarketProductId = fallback.productId
      return fallback
    }

    const selected = state.market.find((entry) => entry.productId === this.selectedMarketProductId)
    if (!selected) {
      this.selectedMarketProductId = fallback.productId
      return fallback
    }

    return selected
  }

  private getSuggestedProductId(
    selectedOrder: GameViewState['orders'][number] | null,
    selectedMarket: GameViewState['market'][number] | null,
    state: GameViewState,
  ): ResourceId | null {
    if (selectedOrder) {
      return selectedOrder.productId
    }

    if (selectedMarket && state.products.some((product) => product.id === selectedMarket.productId && product.unlocked)) {
      return selectedMarket.productId
    }

    return null
  }

  private renderSparkline(history: number[]): string {
    const values = (history?.length ? history : [0]).slice(-8)
    const max = Math.max(...values)
    const min = Math.min(...values)
    const range = Math.max(1, max - min)

    return values
      .map((value) => {
        const height = 18 + Math.round(((value - min) / range) * 20)
        return `<span class="spark-bar" style="height:${height}px"></span>`
      })
      .join('')
  }

  private renderProductionHint(
    suggestedProductId: ResourceId | null,
    currentProductId: ResourceId,
    state: GameViewState,
  ): string {
    if (!suggestedProductId || suggestedProductId === currentProductId) {
      return ''
    }

    const suggestedProduct = state.products.find((product) => product.id === suggestedProductId)
    if (!suggestedProduct) {
      return ''
    }

    return `
      <div class="production-hint">
        <div>
          <p class="panel-kicker">Suggested</p>
          <strong>当前建议切到 ${suggestedProduct.name}</strong>
        </div>
        <button class="ghost-button action-button" data-apply-suggested-product="${suggestedProduct.id}">采纳推荐</button>
      </div>
    `
  }

  private renderStrategyBar(
    selectedOrder: GameViewState['orders'][number] | null,
    selectedMarket: GameViewState['market'][number] | null,
    suggestedProductId: ResourceId | null,
    currentProductId: ResourceId,
    state: GameViewState,
  ): string {
    const decision = this.getStrategicDecision(selectedOrder, selectedMarket)
    const orderPressure = this.getOrderPressure(selectedOrder)
    const marketHeat = this.getMarketHeat(selectedMarket)
    const action = this.getStrategicAction(
      decision.priority,
      selectedOrder,
      selectedMarket,
      suggestedProductId,
      currentProductId,
      state,
    )

    return `
      <div class="strategy-bar strategy-${decision.priority}">
        <div class="strategy-copy">
          <div>
            <p class="panel-kicker">Decision</p>
            <strong>${decision.title}</strong>
          </div>
          <span class="focus-meta">${decision.detail}</span>
        </div>
        <div class="strategy-meters">
          <div class="strategy-meter ${orderPressure >= marketHeat ? 'leading' : ''}">
            <span>订单压力</span>
            <strong>${orderPressure}</strong>
          </div>
          <div class="strategy-meter ${marketHeat > orderPressure ? 'leading' : ''}">
            <span>市场热度</span>
            <strong>${marketHeat}</strong>
          </div>
        </div>
        ${action}
      </div>
    `
  }

  private getStrategicAction(
    priority: 'orders' | 'market' | 'balanced',
    selectedOrder: GameViewState['orders'][number] | null,
    selectedMarket: GameViewState['market'][number] | null,
    suggestedProductId: ResourceId | null,
    currentProductId: ResourceId,
    state: GameViewState,
  ): string {
    if (suggestedProductId && suggestedProductId !== currentProductId) {
      const suggestedProduct = state.products.find((product) => product.id === suggestedProductId)
      if (suggestedProduct) {
        return `<button class="ghost-button action-button" data-apply-suggested-product="${suggestedProduct.id}">切到 ${suggestedProduct.name}</button>`
      }
    }

    if (priority === 'market' && selectedMarket) {
      return `<button class="ghost-button action-button" data-focus-market="${selectedMarket.productId}">查看 ${selectedMarket.name} 行情</button>`
    }

    if (priority === 'orders' && selectedOrder) {
      return `<button class="ghost-button action-button" data-focus-order-product="${selectedOrder.productId}">聚焦 ${this.getResourceName(selectedOrder.productId)}</button>`
    }

    return `<button class="ghost-button action-button" data-order-filter="all">保持观察</button>`
  }

  private renderOrderFocus(order: GameViewState['orders'][number], state: GameViewState): string {
    const urgency = order.remainingMinutes <= 180 ? 'high' : order.remainingMinutes <= 360 ? 'medium' : 'low'
    const gapSummary = this.getOrderGapSummary(order, state)
    const gapActions = this.getOrderGapActions(order, state)

    return `
      <article class="order-focus risk-${order.risk} urgency-${urgency}">
        <div class="order-focus-main">
          <div>
            <p class="panel-kicker">Focused Order</p>
            <h3>${order.clientName} · ${this.getResourceName(order.productId)} x ${order.quantity}</h3>
          </div>
          <div class="order-focus-tags">
            <span class="risk-tag">${this.getRiskLabel(order.risk)}</span>
            <span class="focus-meta">${this.formatDuration(order.remainingMinutes)}</span>
            <span class="focus-meta">报价 ${order.rewardGold}</span>
          </div>
        </div>
        <div class="order-focus-grid">
          <div class="focus-block"><span>优先建议</span><strong>${this.getOrderAdvice(order)}</strong></div>
          <div class="focus-block"><span>交付收益</span><strong>${order.rewardGold} 金币</strong></div>
          <div class="focus-block"><span>目标货物</span><strong>${this.getResourceName(order.productId)}</strong></div>
          <div class="focus-block focus-block-wide gap-focus-block">
            <div class="gap-focus-header">
              <div>
                <span>补单缺口</span>
                <strong>${gapSummary.title}</strong>
              </div>
              ${gapActions}
            </div>
            <p>${gapSummary.detail}</p>
          </div>
        </div>
      </article>
    `
  }

  private getOrderGapSummary(
    order: GameViewState['orders'][number],
    state: GameViewState,
  ): { title: string; detail: string } {
    const inventory = new Map<ResourceId, number>(
      state.resources.map((resource) => [resource.id, resource.amount] as const),
    )
    const rawNeeds = new Map<ResourceId, number>()
    const craftMinutes = this.resolveCraftPlan(order.productId, order.quantity, inventory, rawNeeds, state)
    const remaining = inventory.get(order.productId) ?? 0

    if (remaining >= 0 && rawNeeds.size === 0 && craftMinutes === 0) {
      return {
        title: '现货已够，随时可交',
        detail: `库存里已经有 ${order.quantity} 件 ${this.getResourceName(order.productId)}，可以直接交付。`,
      }
    }

    const rawNeedText = [...rawNeeds.entries()]
      .map(([resourceId, amount]) => `${this.getResourceName(resourceId)} x ${amount}`)
      .join('、')

    if (rawNeedText) {
      return {
        title: `缺 ${rawNeedText}`,
        detail: `若先补原料，再排产补齐，预计还需要 ${this.formatDuration(craftMinutes)}。`,
      }
    }

    return {
      title: `还需排产 ${this.formatDuration(craftMinutes)}`,
      detail: `库存可支撑补单，但还需要继续制作 ${this.getResourceName(order.productId)} 才能交付。`,
    }
  }

  private getOrderGapActions(order: GameViewState['orders'][number], state: GameViewState): string {
    const inventory = new Map<ResourceId, number>(
      state.resources.map((resource) => [resource.id, resource.amount] as const),
    )
    const rawNeeds = new Map<ResourceId, number>()
    const craftMinutes = this.resolveCraftPlan(order.productId, order.quantity, inventory, rawNeeds, state)
    const actions: string[] = []

    rawNeeds.forEach((_, resourceId) => {
      const label =
        resourceId === 'wood'
          ? '补木材'
          : resourceId === 'ore'
            ? '补矿石'
            : `补 ${this.getResourceName(resourceId)}`
      actions.push(`<button class="ghost-button gap-action-button" data-gap-buy="${resourceId}">${label}</button>`)
    })

    if (craftMinutes > 0) {
      actions.push(`<button class="ghost-button gap-action-button" data-gap-focus-product="${order.productId}">切到 ${this.getResourceName(order.productId)}</button>`)
    }

    return actions.length > 0 ? `<div class="gap-actions">${actions.slice(0, 3).join('')}</div>` : ''
  }

  private renderExecutionChain(
    order: GameViewState['orders'][number],
    state: GameViewState,
    currentProductId: ResourceId,
  ): string {
    const inventory = new Map<ResourceId, number>(
      state.resources.map((resource) => [resource.id, resource.amount] as const),
    )
    const rawNeeds = new Map<ResourceId, number>()
    const craftMinutes = this.resolveCraftPlan(order.productId, order.quantity, inventory, rawNeeds, state)
    const needsRaw = rawNeeds.size > 0
    const needsCraft = craftMinutes > 0
    const steps = [
      {
        label: needsRaw ? '补原料' : '原料已齐',
        meta: needsRaw ? [...rawNeeds.entries()].map(([id, amount]) => `${this.getResourceName(id)} x ${amount}`).join('、') : '可直接进入生产',
        tone: needsRaw ? 'current' : 'done',
      },
      {
        label: currentProductId === order.productId ? '配方已对焦' : '切到配方',
        meta: this.getResourceName(order.productId),
        tone: currentProductId === order.productId ? 'done' : needsRaw ? 'upcoming' : 'current',
      },
      {
        label: needsCraft ? '开始生产' : '现货可交',
        meta: needsCraft ? this.formatDuration(craftMinutes) : '无需补做',
        tone: needsCraft ? (currentProductId === order.productId && !needsRaw ? 'current' : 'upcoming') : 'done',
      },
      {
        label: '交付订单',
        meta: `${order.rewardGold} 金币`,
        tone: !needsRaw && !needsCraft ? 'current' : 'upcoming',
      },
    ]

    return `
      <section class="execution-chain">
        <div class="execution-chain-head">
          <p class="panel-kicker">Execution Chain</p>
          <span class="pill">补货 -> 对焦 -> 生产 -> 交付</span>
        </div>
        <div class="execution-chain-track">
          ${steps.map((step) => `
            <article class="chain-step chain-${step.tone}">
              <strong>${step.label}</strong>
              <span>${step.meta}</span>
            </article>
          `).join('')}
        </div>
      </section>
    `
  }

  private resolveCraftPlan(
    resourceId: ResourceId,
    amountNeeded: number,
    inventory: Map<ResourceId, number>,
    rawNeeds: Map<ResourceId, number>,
    state: GameViewState,
  ): number {
    const available = inventory.get(resourceId) ?? 0
    const used = Math.min(available, amountNeeded)
    inventory.set(resourceId, available - used)

    const remaining = amountNeeded - used
    if (remaining <= 0) {
      return 0
    }

    const definition = productConfig[resourceId]
    if (definition.inputs.length === 0) {
      rawNeeds.set(resourceId, (rawNeeds.get(resourceId) ?? 0) + remaining)
      return 0
    }

    let totalMinutes = this.getCraftMinutes(resourceId, state) * remaining
    for (const input of definition.inputs) {
      totalMinutes += this.resolveCraftPlan(input.resourceId, input.amount * remaining, inventory, rawNeeds, state)
    }
    return totalMinutes
  }

  private getCraftMinutes(resourceId: ResourceId, state: GameViewState): number {
    return state.products.find((product) => product.id === resourceId)?.durationMinutes ?? 0
  }

  private renderExpandedOrderCard(
    order: GameViewState['orders'][number],
    isSelected: boolean,
  ): string {
    return `
      <article class="order-card risk-${order.risk} compact-card ${isSelected ? 'selected' : ''}" data-select-order="${order.id}">
        <div class="order-head">
          <div><p class="order-client">${order.clientName}</p><h3>${this.getResourceName(order.productId)} x ${order.quantity}</h3></div>
          <div class="order-head-actions">
            <span class="risk-tag">${this.getRiskLabel(order.risk)}</span>
            <button class="ghost-button" data-select-order-button="${order.id}">聚焦</button>
          </div>
        </div>
        <div class="order-meta"><span>报价 ${order.rewardGold}</span><span>${this.formatDuration(order.remainingMinutes)}</span></div>
        <button data-order="${order.id}">交付订单</button>
      </article>
    `
  }

  private renderCompactOrderCard(
    order: GameViewState['orders'][number],
    isSelected: boolean,
  ): string {
    return `
      <article class="order-card compact-order-card risk-${order.risk} compact-card ${isSelected ? 'selected' : ''}" data-select-order="${order.id}">
        <div class="compact-order-main">
          <div class="compact-order-title">
            <p class="order-client">${order.clientName}</p>
            <h3>${this.getResourceName(order.productId)} x ${order.quantity}</h3>
          </div>
          <div class="compact-order-inline">
            <span class="risk-tag">${this.getRiskLabel(order.risk)}</span>
            <span class="focus-meta">报价 ${order.rewardGold}</span>
            <span class="focus-meta">${this.formatDuration(order.remainingMinutes)}</span>
          </div>
        </div>
        <div class="compact-order-actions">
          <button class="ghost-button" data-select-order-button="${order.id}">聚焦</button>
          <button data-order="${order.id}">交付</button>
        </div>
      </article>
    `
  }

  private renderMarketFocus(market: GameViewState['market'][number], state: GameViewState): string {
    const targetMatch = state.automation.targetProductId === market.productId

    return `
      <article class="market-focus trend-${market.trend}">
        <div class="market-focus-main">
          <div>
            <p class="panel-kicker">Primary Market</p>
            <h3>${market.name}</h3>
          </div>
          <div class="market-focus-tags">
            <span class="focus-meta">${this.getTrendLabel(market.trend)}</span>
            <span class="focus-meta">系数 ${market.multiplier.toFixed(2)}</span>
            <span class="focus-meta">单价 ${market.unitPrice}</span>
          </div>
        </div>
        <div class="market-focus-grid">
          <div class="focus-block"><span>卖出建议</span><strong>${this.getMarketAdvice(market)}</strong></div>
          <div class="focus-block"><span>自动化联动</span><strong>${targetMatch ? '当前就是自动生产目标' : '可考虑切换为自动生产目标'}</strong></div>
          <div class="focus-block"><span>主卖判断</span><strong>${this.getBestMarketLine(state)}</strong></div>
        </div>
        <div class="focus-actions">
          <button class="ghost-button action-button" data-adopt-market-target="${market.productId}">
            ${targetMatch ? '已是自动目标' : '设为自动生产目标'}
          </button>
        </div>
      </article>
    `
  }

  private renderOrderSnapshot(state: GameViewState): string {
    const rushCount = state.orders.filter((order) => order.risk === 'rush').length
    const premiumCount = state.orders.filter((order) => order.risk === 'premium').length
    const stableCount = state.orders.filter((order) => order.risk === 'stable').length
    const bestReward = [...state.orders].sort((left, right) => right.rewardGold - left.rewardGold)[0]

    return `
      <span class="snapshot-pill">急单 ${rushCount}</span>
      <span class="snapshot-pill">高利 ${premiumCount}</span>
      <span class="snapshot-pill">稳定 ${stableCount}</span>
      <span class="snapshot-pill emphasis">最高报酬 ${bestReward ? bestReward.rewardGold : '--'}</span>
    `
  }

  private renderFloatingFeed(state: GameViewState): string {
    const recentLogs = state.logs.slice(0, 2)

    return `
      <aside class="toast-feed" aria-label="经营日志">
        ${recentLogs.map((log, index) => `
          <article class="toast-item ${index === 0 ? 'primary' : ''}">
            <p>${log}</p>
          </article>
        `).join('')}
      </aside>
    `
  }

  private renderUtilityDrawer(state: GameViewState): string {
    if (!this.utilityPanel) {
      return ''
    }

    if (this.utilityPanel === 'employees') {
      return `
        <section class="utility-drawer">
          <div class="utility-drawer-head">
            <div><p class="panel-kicker">People</p><h2>员工管理</h2></div>
            <button class="collapse-button" data-close-utility>关闭</button>
          </div>
          <div class="utility-drawer-body scroll-list">
            ${state.employees.map((employee) => `
              <article class="upgrade-card compact-card">
                <div><h3>${employee.name}</h3><p>${employee.description}</p></div>
                <div class="upgrade-meta">
                  <span>${employee.count}/${employee.maxCount}</span>
                  <button data-hire="${employee.id}">雇佣 ${employee.hireCost}</button>
                </div>
              </article>
            `).join('')}
          </div>
        </section>
      `
    }

    return `
      <section class="utility-drawer">
        <div class="utility-drawer-head">
          <div><p class="panel-kicker">Upgrades</p><h2>升级中心</h2></div>
          <button class="collapse-button" data-close-utility>关闭</button>
        </div>
        <div class="utility-drawer-body scroll-list">
          ${state.upgrades.map((upgrade) => `
            <article class="upgrade-card compact-card">
              <div><h3>${upgrade.name}</h3><p>${upgrade.description}</p></div>
              <div class="upgrade-meta">
                <span>Lv.${upgrade.level}/${upgrade.maxLevel}</span>
                <button data-upgrade="${upgrade.id}" ${upgrade.cost === null ? 'disabled' : ''}>
                  ${upgrade.cost === null ? '满级' : `升级 ${upgrade.cost}`}
                </button>
              </div>
            </article>
          `).join('')}
        </div>
      </section>
    `
  }

  private getBestMarketLine(state: GameViewState): string {
    const best = [...state.market].sort((left, right) => right.unitPrice - left.unitPrice)[0]
    return best ? `${best.name} ${best.unitPrice}` : '暂无'
  }

  private getOrderPressure(order: GameViewState['orders'][number] | null): number {
    if (!order) {
      return 18
    }

    const urgencyScore = Math.max(10, 100 - Math.min(order.remainingMinutes, 600) / 6)
    const rewardScore = Math.min(28, order.rewardGold / 10)
    const riskBonus = order.risk === 'rush' ? 14 : order.risk === 'premium' ? 10 : 4
    return Math.min(99, Math.round(urgencyScore + rewardScore + riskBonus))
  }

  private getMarketHeat(market: GameViewState['market'][number] | null): number {
    if (!market) {
      return 14
    }

    const multiplierScore = Math.min(72, market.multiplier * 48)
    const trendBonus = market.trend === 'up' ? 18 : market.trend === 'down' ? -8 : 6
    return Math.max(8, Math.min(99, Math.round(multiplierScore + trendBonus)))
  }

  private getMarketAdvice(market: GameViewState['market'][number]): string {
    if (market.trend === 'up' && market.multiplier >= 1.2) return '价格强势，可以优先出货'
    if (market.trend === 'down' && market.multiplier <= 0.9) return '价格偏弱，更适合暂缓卖出'
    if (market.multiplier >= 1.05) return '报价尚可，适合稳定套现'
    return '先观察下一轮市场波动'
  }

  private getStrategicDecision(
    selectedOrder: GameViewState['orders'][number] | null,
    selectedMarket: GameViewState['market'][number] | null,
  ): { priority: 'orders' | 'market' | 'balanced'; title: string; detail: string } {
    if (selectedOrder && selectedOrder.remainingMinutes <= 180) {
      return {
        priority: 'orders',
        title: '先保订单时限',
        detail: `${this.getResourceName(selectedOrder.productId)} 还剩 ${this.formatDuration(selectedOrder.remainingMinutes)}`,
      }
    }

    if (selectedMarket && selectedMarket.trend === 'up' && selectedMarket.multiplier >= 1.25) {
      return {
        priority: 'market',
        title: '先抓高价卖点',
        detail: `${selectedMarket.name} 单价 ${selectedMarket.unitPrice}，趋势上行`,
      }
    }

    if (selectedOrder) {
      return {
        priority: 'balanced',
        title: '维持生产交单节奏',
        detail: `${this.getResourceName(selectedOrder.productId)} 订单可作为现金流主线`,
      }
    }

    if (selectedMarket) {
      return {
        priority: 'market',
        title: '围绕市场主卖商品组织生产',
        detail: `${selectedMarket.name} 当前报价 ${selectedMarket.unitPrice}`,
      }
    }

    return {
      priority: 'balanced',
      title: '先补库存并等待机会',
      detail: '当前没有强优先级冲突，维持基础生产',
    }
  }

  private getResourceGapText(resourceAmount: number, capacity: number, resourceId: ResourceId): string {
    const missing = Math.max(0, capacity - resourceAmount)
    if (resourceAmount === 0) return `缺 ${missing}`
    if (missing <= 2) return '接近满仓'
    if (resourceConfig[resourceId].category === 'raw') return `待补 ${missing}`
    return `余量 ${missing}`
  }

  private getRiskLabel(risk: string): string {
    if (risk === 'premium') return '高收益'
    if (risk === 'rush') return '急单'
    return '稳定'
  }

  private getOrderAdvice(order: GameViewState['orders'][number]): string {
    if (order.risk === 'premium') return '高报酬，但先确认库存和产能'
    if (order.risk === 'rush') return '时限偏紧，适合优先插单'
    if (order.remainingMinutes <= 180) return '剩余时间偏短，尽快安排交付'
    return '稳定订单，可作为现金流补位'
  }

  private getStageLabel(stage: string): string {
    if (stage === 'raw') return '原料'
    if (stage === 'finished') return '成品'
    return '中间品'
  }

  private getTrendLabel(trend: string): string {
    if (trend === 'up') return '上涨'
    if (trend === 'down') return '下跌'
    return '平稳'
  }

  private getResourceName(resourceId: ResourceId): string {
    return resourceConfig[resourceId].name
  }

  private formatClock(hour: number, minute: number): string {
    return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
  }

  private formatDuration(minutes: number): string {
    const hours = Math.floor(minutes / 60)
    const remainingMinutes = minutes % 60
    return `${hours}h ${remainingMinutes}m`
  }
}
