export type EmployeeId = 'artisan' | 'merchant'

export interface EmployeeDefinition {
  id: EmployeeId
  name: string
  description: string
  hireCost: number
  dailyWage: number
  maxCount: number
}
