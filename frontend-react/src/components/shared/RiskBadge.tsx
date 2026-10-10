import { Badge } from '@/components/ui/badge'
import type { RiskLevel } from '@/types/operations'

const risks = {
  critical: { label: 'Crítico', className: 'border-risk-critical/25 bg-risk-critical/10 text-risk-critical' },
  high: { label: 'Alto', className: 'border-risk-high/25 bg-risk-high/10 text-risk-high' },
  attention: { label: 'Atenção', className: 'border-risk-attention/25 bg-risk-attention/10 text-risk-attention' },
} satisfies Record<RiskLevel, { label: string; className: string }>

export function RiskBadge({ level }: { level: RiskLevel }) {
  const risk = risks[level]
  return <Badge variant="outline" className={`${risk.className} px-1.5 py-0 text-xs`}>{risk.label}</Badge>
}
