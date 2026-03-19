import type { ProductDefinition } from '../models/Product'
import type { ResourceId } from '../models/Resource'

export const productConfig: Record<ResourceId, ProductDefinition> = {
  wood: {
    id: 'wood',
    name: '木材',
    description: '基础原料，用来切割木板。',
    stage: 'raw',
    craftMinutes: 0,
    inputs: [],
    outputAmount: 0,
    suggestedPrice: 0,
  },
  ore: {
    id: 'ore',
    name: '矿石',
    description: '基础原料，用来冶炼铁件。',
    stage: 'raw',
    craftMinutes: 0,
    inputs: [],
    outputAmount: 0,
    suggestedPrice: 0,
  },
  plank: {
    id: 'plank',
    name: '木板',
    description: '基础中间品，稳定、便宜、周转快。',
    stage: 'intermediate',
    craftMinutes: 60,
    inputs: [{ resourceId: 'wood', amount: 2 }],
    outputAmount: 1,
    suggestedPrice: 28,
  },
  metalParts: {
    id: 'metalParts',
    name: '铁件',
    description: '高级中间品，利润更高，但必须先解锁金工台。',
    stage: 'intermediate',
    craftMinutes: 90,
    inputs: [{ resourceId: 'ore', amount: 2 }],
    outputAmount: 1,
    suggestedPrice: 42,
    unlockUpgradeId: 'metalworking',
  },
  toolkit: {
    id: 'toolkit',
    name: '工具箱',
    description: '终端成品，依赖完整生产链，适合自动化与高价销售。',
    stage: 'finished',
    craftMinutes: 150,
    inputs: [
      { resourceId: 'plank', amount: 2 },
      { resourceId: 'metalParts', amount: 1 },
    ],
    outputAmount: 1,
    suggestedPrice: 96,
    unlockUpgradeId: 'engineering',
  },
}

export const craftableProductIds: ResourceId[] = ['plank', 'metalParts', 'toolkit']
export const marketProductIds: ResourceId[] = ['plank', 'metalParts', 'toolkit']
