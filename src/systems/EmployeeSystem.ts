import { employeeConfig } from '../config/employeeConfig'
import type { EmployeeId } from '../models/Employee'
import type { PlayerState } from '../models/PlayerState'

export class EmployeeSystem {
  hire(player: PlayerState, employeeId: EmployeeId): { ok: boolean; reason?: string; cost?: number } {
    const definition = employeeConfig.find((item) => item.id === employeeId)
    if (!definition) {
      return { ok: false, reason: '员工类型不存在。' }
    }

    if (player.employees[employeeId] >= definition.maxCount) {
      return { ok: false, reason: '该员工已达到雇佣上限。' }
    }

    if (player.gold < definition.hireCost) {
      return { ok: false, reason: '金币不足，无法雇佣。' }
    }

    player.gold -= definition.hireCost
    player.employees[employeeId] += 1
    return { ok: true, cost: definition.hireCost }
  }

  getProductionSpeedBonus(player: PlayerState): number {
    return 1 + player.employees.artisan * 0.08
  }

  getMarketSalesBonus(player: PlayerState): number {
    return 1 + player.employees.merchant * 0.06
  }

  collectDailyWages(player: PlayerState): { total: number; breakdown: string[] } {
    const breakdown = employeeConfig
      .filter((employee) => player.employees[employee.id] > 0)
      .map((employee) => `${employee.name} x${player.employees[employee.id]}: ${employee.dailyWage * player.employees[employee.id]}`)

    const total = employeeConfig.reduce((sum, employee) => {
      return sum + employee.dailyWage * player.employees[employee.id]
    }, 0)

    player.gold = Math.max(0, player.gold - total)
    return { total, breakdown }
  }
}
