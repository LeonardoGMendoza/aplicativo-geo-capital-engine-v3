import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
export function PanelHeading({ title, subtitle, icon: Icon, children }: { title: string; subtitle?: string; icon?: LucideIcon; children?: ReactNode }) {
  return <div className="panel-heading">{Icon && <span className="panel-heading-icon"><Icon className="size-3.5" aria-hidden="true" /></span>}<div className="min-w-0 flex-1"><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div>{children}</div>
}
