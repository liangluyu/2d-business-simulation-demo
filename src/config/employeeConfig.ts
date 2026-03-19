import type { EmployeeDefinition } from '../models/Employee'

export const employeeConfig: EmployeeDefinition[] = [
  {
    id: 'artisan',
    name: '工匠',
    description: '每名工匠让生产速度提高 8%。',
    hireCost: 140,
    dailyWage: 12,
    maxCount: 6,
  },
  {
    id: 'merchant',
    name: '销售员',
    description: '每名销售员让市场出售价格提高 6%。',
    hireCost: 160,
    dailyWage: 14,
    maxCount: 4,
  },
]
