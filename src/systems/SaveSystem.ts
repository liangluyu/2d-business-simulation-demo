import type { MarketSnapshot } from '../models/Market'
import type { Order } from '../models/Order'
import type { PlayerState } from '../models/PlayerState'

export interface SavePayload {
  version: 1
  savedAt: string
  totalMinutes: number
  player: PlayerState
  orders: Order[]
  nextOrderRefreshAt: number
  market: MarketSnapshot
  logs: string[]
  automationMeta: {
    lastAutoPurchaseMinute: number
    lastAutoSellMinute: number
  }
}

export class SaveSystem {
  private readonly storageKey = 'workshop-sim-save'

  save(payload: SavePayload): void {
    localStorage.setItem(this.storageKey, JSON.stringify(payload))
  }

  load(): SavePayload | null {
    const raw = localStorage.getItem(this.storageKey)
    if (!raw) {
      return null
    }

    try {
      return JSON.parse(raw) as SavePayload
    } catch {
      return null
    }
  }
}
