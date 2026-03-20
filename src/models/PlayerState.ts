import type { ResourceId } from './Resource'

export type AutoPurchaseMode = 'deficit' | 'balanced' | 'stockpile'

export interface UpgradeLevels {
  workshopTools: number
  salesmanship: number
  storage: number
  metalworking: number
  engineering: number
}

export interface ActiveProduction {
  productId: ResourceId
  progressMinutes: number
  totalMinutes: number
}

export interface AutomationState {
  autoProductionEnabled: boolean
  autoPurchaseEnabled: boolean
  autoPurchaseMode: AutoPurchaseMode
  autoSellEnabled: boolean
  targetProductId: ResourceId | null
  sellReserve: number
}

export interface EmployeeRoster {
  artisan: number
  merchant: number
}

export interface PlayerState {
  gold: number
  resources: Record<ResourceId, number>
  upgrades: UpgradeLevels
  unlockedProducts: ResourceId[]
  activeProduction: ActiveProduction | null
  automation: AutomationState
  employees: EmployeeRoster
}
