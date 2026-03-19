import type { ResourceId } from '../models/Resource'

export const marketConfig = {
  updateEveryMinutes: 120,
  minMultiplier: 0.72,
  maxMultiplier: 1.42,
  stepRange: 0.14,
}

export const marketVolatility: Record<ResourceId, number> = {
  wood: 0,
  ore: 0,
  plank: 0.08,
  metalParts: 0.1,
  toolkit: 0.14,
}

export const initialMarketMultipliers: Partial<Record<ResourceId, number>> = {
  plank: 1,
  metalParts: 1,
  toolkit: 1,
}
