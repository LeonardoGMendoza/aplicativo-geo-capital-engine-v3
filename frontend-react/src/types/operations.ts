export type RiskLevel = 'critical' | 'high' | 'attention'

export interface DemoAlert {
  id: string
  title: string
  location: string
  risk: RiskLevel
  distanceKm: number
  description: string
  recommendation: string
  displayTime: string
  isPriority: boolean
  mapPosition?: { left: string; top: string; labelX: number; labelY: number }
  isSimulation: true
}

export interface DemoSnapshot {
  source: 'Cenário demonstrativo local'
  timestamp: string
  isSimulation: true
  assets: number
  communities: number
  shelters: number
  people: number
  alerts: DemoAlert[]
}
