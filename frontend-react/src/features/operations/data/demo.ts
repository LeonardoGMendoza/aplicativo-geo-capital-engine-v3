import type { DemoAlert, DemoSnapshot } from '../../../types/operations.ts'

// Cenário ilustrativo único. Nenhum destes números vem da NASA.
export const demoShelters = [
  { id: 'shelter-central', name: 'Escola Municipal Central', address: 'Rua das Flores, 123', used: 320, capacity: 500, distance: '1,2 km', mapPosition: { left: '49%', top: '23%' } },
  { id: 'shelter-vila-nova', name: 'Ginásio Vila Nova', address: 'Av. Principal, 456', used: 450, capacity: 600, distance: '3,4 km', mapPosition: { left: '74%', top: '52%' } },
  { id: 'shelter-jardim', name: 'Colégio Jardim das Flores', address: 'Rua Amarela, 789', used: 280, capacity: 450, distance: '4,7 km', mapPosition: { left: '36%', top: '78%' } },
  { id: 'shelter-sao-miguel', name: 'UBS São Miguel', address: 'Rua do Sol, 100', used: 190, capacity: 300, distance: '5,0 km' },
] as const
export const demoMapShelters = demoShelters.flatMap(shelter => 'mapPosition' in shelter ? [shelter] : [])

export const demoWater = {
  location: 'Rio Verde',
  timeline: [{ hour: 'Agora', level: 1.2 }, { hour: '6h', level: 1.7 }, { hour: '12h', level: 2.4 }, { hour: '18h', level: 4.1 }, { hour: '24h', level: 3.6 }],
}

// Fixture de interface. Não representa consulta à NASA, previsão ou cadastro validado.
export const demoSnapshot: DemoSnapshot = {
  source: 'Cenário demonstrativo local',
  timestamp: '2026-10-08T14:30:00-03:00',
  isSimulation: true,
  assets: 11,
  communities: 8,
  shelters: demoShelters.length,
  people: 1800,
  alerts: [
    {
      id: 'demo-01', title: 'Risco de inundação severa', location: 'Região Central · fictícia',
      displayTime: '14:28', isPriority: true, mapPosition: { left: '25%', top: '35%', labelX: 92, labelY: 74 },
      risk: 'critical', distanceKm: 42, isSimulation: true,
      description: 'Exemplo fictício de chuva intensa próximo a uma área comunitária. Distância e nível de risco são ilustrativos.',
      recommendation: 'Revisar o cenário com a equipe responsável e verificar a disponibilidade dos pontos de apoio antes de orientar a comunidade.',
    },
    {
      id: 'demo-02', title: 'Deslizamento de terra', location: 'Morro do Sol · fictício',
      displayTime: '13:50', isPriority: true, mapPosition: { left: '17%', top: '56%', labelX: 90, labelY: 270 },
      risk: 'high', distanceKm: 410, isSimulation: true,
      description: 'Exemplo fictício de deslizamento em uma região ilustrativa. Não é um evento atual da NASA.',
      recommendation: 'Revisar as condições operacionais e os protocolos de proteção do ativo com o gestor responsável.',
    },
    {
      id: 'demo-03', title: 'Elevação rápida do rio', location: 'Rio Verde · fictício',
      displayTime: '12:16', isPriority: true, mapPosition: { left: '56%', top: '47%', labelX: 395, labelY: 125 },
      risk: 'attention', distanceKm: 185, isSimulation: true,
      description: 'Exemplo fictício para avaliação visual de um alerta de atenção. Nenhuma previsão meteorológica foi consultada.',
      recommendation: 'Conferir canais oficiais e revisar o plano local de preparação antes de tomar qualquer decisão.',
    },
    ...[
      { id: 'demo-04', title: 'Chuvas intensas', location: 'Zona Norte · fictícia', risk: 'high' as const },
      { id: 'demo-05', title: 'Ventos fortes', location: 'Região Oeste · fictícia', risk: 'attention' as const },
      { id: 'demo-06', title: 'Alagamento', location: 'Vila Nova · fictícia', risk: 'attention' as const },
    ].map((item): DemoAlert => ({ ...item, displayTime: 'Não informado', isPriority: false, distanceKm: 30, isSimulation: true,
      description: 'Alerta fictício da referência visual. Nenhuma fonte externa consultada.',
      recommendation: 'Revisar as informações com a equipe responsável e consultar fontes oficiais antes de agir.' })),
  ],
}

export const DEFAULT_ALERT_ID = 'demo-01'
export function getDemoAlert(id: string, alerts: readonly DemoAlert[] = demoSnapshot.alerts) {
  const alert = alerts.find(item => item.id === id)
  if (!alert) throw new Error(`Alerta demonstrativo desconhecido: ${id}`)
  return alert
}
export function recommendationTitle(alert: DemoAlert) {
  return `Revisar aviso para ${alert.location.split(' · ')[0]}`
}
export const priorityAlerts = demoSnapshot.alerts.filter(alert => alert.isPriority)
export const demoIndicators = {
  criticalAlerts: demoSnapshot.alerts.filter(alert => alert.risk === 'critical').length,
  attentionAlerts: demoSnapshot.alerts.filter(alert => alert.risk !== 'critical').length,
  totalAlerts: demoSnapshot.alerts.length,
  priorityAlerts: priorityAlerts.length,
  shelters: demoShelters.length,
  people: demoSnapshot.people,
  shelterOccupancy: demoShelters.reduce((total, shelter) => total + shelter.used, 0),
  waterLevel: demoWater.timeline.find(point => point.hour === 'Agora')!.level,
  corporate: { assetsAtRisk: 2, affectedOperations: 1, interruptions: 0, recommendations: priorityAlerts.length },
  realActions: 0,
}
export function waterTimelineDescription() {
  return `Série fictícia do nível do ${demoWater.location}: ${demoWater.timeline.map(point => `${point.hour} ${point.level.toLocaleString('pt-BR')} m`).join(', ')}. Não é previsão.`
}

export function formatSnapshotTime(timestamp: string) {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(new Date(timestamp))
}
