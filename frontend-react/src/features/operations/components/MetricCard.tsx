import type { LucideIcon } from 'lucide-react'
const tones = {
  red: { bg: '#fff1f3', text: '#ce1638', icon: '#fa244b' },
  orange: { bg: '#fff7ec', text: '#a75d00', icon: '#f5a016' },
  blue: { bg: '#eff6ff', text: '#0660d7', icon: '#0773f9' },
  green: { bg: '#edf9f3', text: '#08785f', icon: '#0aaa86' },
}
export function MetricCard({ title, value, note, icon: Icon, tone }: { title: string; value: number | string; note: string; icon: LucideIcon; tone: keyof typeof tones }) {
  const colors = tones[tone]
  return <div className="flex min-w-0 flex-col items-start sm:flex-row gap-2 rounded-lg border border-white/80 px-3 py-3 shadow-sm" style={{ background: colors.bg, color: colors.text }}>
    <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full text-white" style={{ background: colors.icon }}><Icon className="size-4" aria-hidden="true" /></span>
    <div className="min-w-0"><p className="metric-value text-2xl font-bold leading-none">{value}</p><p className="mt-1 text-xs font-semibold leading-snug">{title}</p><p className="mt-1 text-xs leading-snug">{note}</p></div>
  </div>
}
