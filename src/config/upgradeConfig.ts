import type { UpgradeLevels } from '../models/PlayerState'

export type UpgradeId = keyof UpgradeLevels

export interface UpgradeDefinition {
  id: UpgradeId
  name: string
  description: string
  maxLevel: number
  baseCost: number
  costGrowth: number
}

export const upgradeConfig: UpgradeDefinition[] = [
  {
    id: 'workshopTools',
    name: '工坊工具',
    description: '每级让所有生产耗时减少 12%。',
    maxLevel: 5,
    baseCost: 90,
    costGrowth: 1.7,
  },
  {
    id: 'salesmanship',
    name: '议价技巧',
    description: '每级让订单收入提高 10%。',
    maxLevel: 5,
    baseCost: 120,
    costGrowth: 1.8,
  },
  {
    id: 'storage',
    name: '仓储扩容',
    description: '每级让所有资源容量增加 8。',
    maxLevel: 4,
    baseCost: 80,
    costGrowth: 1.65,
  },
  {
    id: 'metalworking',
    name: '金工台',
    description: '解锁铁件生产与相关订单。',
    maxLevel: 1,
    baseCost: 180,
    costGrowth: 1,
  },
  {
    id: 'engineering',
    name: '装配蓝图',
    description: '解锁工具箱生产与高利润订单。',
    maxLevel: 1,
    baseCost: 320,
    costGrowth: 1,
  },
]
