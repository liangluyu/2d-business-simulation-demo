import { resourceConfig } from '../config/resourceConfig'
import type { PlayerState } from '../models/PlayerState'
import type { ResourceId } from '../models/Resource'

export class ResourceSystem {
  createInitialResources(): PlayerState['resources'] {
    return {
      wood: resourceConfig.wood.startingAmount,
      ore: resourceConfig.ore.startingAmount,
      plank: resourceConfig.plank.startingAmount,
      metalParts: resourceConfig.metalParts.startingAmount,
      toolkit: resourceConfig.toolkit.startingAmount,
    }
  }

  getCapacity(player: PlayerState, resourceId: ResourceId): number {
    return resourceConfig[resourceId].baseCapacity + player.upgrades.storage * 8
  }

  canAfford(player: PlayerState, cost: Partial<Record<ResourceId, number>>): boolean {
    return Object.entries(cost).every(([resourceId, amount]) => {
      if (amount === undefined) {
        return true
      }

      return player.resources[resourceId as ResourceId] >= amount
    })
  }

  hasStorageSpace(player: PlayerState, resourceId: ResourceId, amount: number): boolean {
    return player.resources[resourceId] + amount <= this.getCapacity(player, resourceId)
  }

  addResource(player: PlayerState, resourceId: ResourceId, amount: number): boolean {
    if (!this.hasStorageSpace(player, resourceId, amount)) {
      return false
    }

    player.resources[resourceId] += amount
    return true
  }

  spendResources(player: PlayerState, cost: Partial<Record<ResourceId, number>>): boolean {
    if (!this.canAfford(player, cost)) {
      return false
    }

    Object.entries(cost).forEach(([resourceId, amount]) => {
      if (amount !== undefined) {
        player.resources[resourceId as ResourceId] -= amount
      }
    })

    return true
  }

  removeResource(player: PlayerState, resourceId: ResourceId, amount: number): boolean {
    if (player.resources[resourceId] < amount) {
      return false
    }

    player.resources[resourceId] -= amount
    return true
  }
}
