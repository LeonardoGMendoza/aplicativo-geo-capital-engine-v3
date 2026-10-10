import { demoIndicators, demoShelters, demoWater } from './demo.ts'

// Projeção da fonte única do cenário; preserva os consumidores visuais existentes.
export const visualDemo = {
  criticalAreas: demoIndicators.criticalAlerts,
  attentionAreas: demoIndicators.attentionAlerts,
  shelters: demoIndicators.shelters,
  people: demoIndicators.people.toLocaleString('pt-BR'),
  waterLevel: demoIndicators.waterLevel,
  timeline: demoWater.timeline,
  sheltersList: demoShelters,
  cameras: ['Ponte Central', 'Rio Verde', 'Vila Nova'],
} as const
