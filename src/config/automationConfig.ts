export const automationConfig = {
  autoPurchaseEveryMinutes: 20,
  autoSellEveryMinutes: 60,
  defaultSellReserve: 2,
  purchaseBatchSize: {
    wood: 5,
    ore: 4,
  },
  purchaseModeLabels: {
    deficit: '按缺口',
    balanced: '平衡备货',
    stockpile: '积极备货',
  },
  purchaseModeDescriptions: {
    deficit: '只补当前生产链缺口，最省钱。',
    balanced: '补缺口并多备一批，减少停工频率。',
    stockpile: '尽量把原料仓补到安全线，适合持续跑产线。',
  },
  purchaseSafetyStock: {
    deficit: {
      wood: 0,
      ore: 0,
    },
    balanced: {
      wood: 5,
      ore: 4,
    },
    stockpile: {
      wood: 15,
      ore: 12,
    },
  },
}
