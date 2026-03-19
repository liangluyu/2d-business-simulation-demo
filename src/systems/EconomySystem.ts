import { employeeConfig } from '../config/employeeConfig'
import { resourceConfig } from '../config/resourceConfig'
import { upgradeConfig, type UpgradeId } from '../config/upgradeConfig'
import type { EmployeeId } from '../models/Employee'
import type { PlayerState } from '../models/PlayerState'
import type { ResourceId } from '../models/Resource'

export class EconomySystem {
  buyRawMaterial(
    player: PlayerState,
    resourceId: ResourceId,
    amount: number,
    capacityCheck: () => boolean,
  ): { ok: boolean; reason?: string; totalCost?: number } {
    const definition = resourceConfig[resourceId]

    if (!definition.buyPrice) {
      return { ok: false, reason: '该资源不可采购。' }
    }

    if (!capacityCheck()) {
      return { ok: false, reason: '仓储空间不足。' }
    }

    const totalCost = definition.buyPrice * amount
    if (player.gold < totalCost) {
      return { ok: false, reason: '金币不足。' }
    }

    player.gold -= totalCost
    return { ok: true, totalCost }
  }

  getUpgradeCost(player: PlayerState, upgradeId: UpgradeId): number | null {
    const definition = upgradeConfig.find((item) => item.id === upgradeId)
    if (!definition) {
      return null
    }

    const level = player.upgrades[upgradeId]
    if (level >= definition.maxLevel) {
      return null
    }

    return Math.round(definition.baseCost * Math.pow(definition.costGrowth, level))
  }

  buyUpgrade(player: PlayerState, upgradeId: UpgradeId): { ok: boolean; reason?: string; cost?: number } {
    const definition = upgradeConfig.find((item) => item.id === upgradeId)
    if (!definition) {
      return { ok: false, reason: '升级不存在。' }
    }

    const cost = this.getUpgradeCost(player, upgradeId)
    if (cost === null) {
      return { ok: false, reason: '该升级已满级。' }
    }

    if (player.gold < cost) {
      return { ok: false, reason: '金币不足。' }
    }

    player.gold -= cost
    player.upgrades[upgradeId] += 1
    return { ok: true, cost }
  }

  getEmployeeHireCost(employeeId: EmployeeId): number {
    return employeeConfig.find((item) => item.id === employeeId)?.hireCost ?? 0
  }
}
