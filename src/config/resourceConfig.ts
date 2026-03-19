import type { ResourceDefinition, ResourceId } from '../models/Resource'

export const resourceConfig: Record<ResourceId, ResourceDefinition> = {
  wood: {
    id: 'wood',
    name: '木材',
    category: 'raw',
    baseCapacity: 30,
    buyPrice: 6,
    startingAmount: 10,
  },
  ore: {
    id: 'ore',
    name: '矿石',
    category: 'raw',
    baseCapacity: 24,
    buyPrice: 8,
    startingAmount: 6,
  },
  plank: {
    id: 'plank',
    name: '木板',
    category: 'processed',
    baseCapacity: 20,
    startingAmount: 0,
  },
  metalParts: {
    id: 'metalParts',
    name: '铁件',
    category: 'processed',
    baseCapacity: 18,
    startingAmount: 0,
  },
  toolkit: {
    id: 'toolkit',
    name: '工具箱',
    category: 'finished',
    baseCapacity: 12,
    startingAmount: 0,
  },
}
