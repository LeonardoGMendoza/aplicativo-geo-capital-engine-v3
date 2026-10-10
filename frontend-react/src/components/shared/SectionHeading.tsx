import type { ReactNode } from 'react'

export function SectionHeading({ eyebrow, title, children }: { eyebrow?: string; title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        {eyebrow && <p className="mb-1 text-xs font-semibold uppercase tracking-[0.18em] text-primary">{eyebrow}</p>}
        <h2 className="text-base font-semibold tracking-tight">{title}</h2>
      </div>
      {children}
    </div>
  )
}
