import type { OrderRisk } from '../models/Order'
import type { ResourceId } from '../models/Resource'

export interface OrderTemplate {
  productId: ResourceId
  minQuantity: number
  maxQuantity: number
  baseMultiplier: number
  risk: OrderRisk
  minExpireMinutes: number
  maxExpireMinutes: number
}

export const orderBoardConfig = {
  maxOrders: 5,
  refreshEveryMinutes: 180,
  minOrdersPerRefresh: 2,
  maxOrdersPerRefresh: 3,
}

export const orderClients = [
  '码头仓管',
  '山路商队',
  '旅店掌柜',
  '农庄监工',
  '城墙工头',
  '巡逻队军需官',
]

export const orderTemplates: OrderTemplate[] = [
  {
    productId: 'plank',
    minQuantity: 2,
    maxQuantity: 5,
    baseMultiplier: 1.05,
    risk: 'stable',
    minExpireMinutes: 420,
    maxExpireMinutes: 720,
  },
  {
    productId: 'plank',
    minQuantity: 4,
    maxQuantity: 7,
    baseMultiplier: 1.25,
    risk: 'rush',
    minExpireMinutes: 240,
    maxExpireMinutes: 420,
  },
  {
    productId: 'metalParts',
    minQuantity: 2,
    maxQuantity: 5,
    baseMultiplier: 1.2,
    risk: 'stable',
    minExpireMinutes: 420,
    maxExpireMinutes: 720,
  },
  {
    productId: 'metalParts',
    minQuantity: 4,
    maxQuantity: 6,
    baseMultiplier: 1.45,
    risk: 'premium',
    minExpireMinutes: 300,
    maxExpireMinutes: 480,
  },
  {
    productId: 'toolkit',
    minQuantity: 1,
    maxQuantity: 3,
    baseMultiplier: 1.5,
    risk: 'stable',
    minExpireMinutes: 420,
    maxExpireMinutes: 720,
  },
  {
    productId: 'toolkit',
    minQuantity: 2,
    maxQuantity: 4,
    baseMultiplier: 1.9,
    risk: 'premium',
    minExpireMinutes: 240,
    maxExpireMinutes: 360,
  },
]
