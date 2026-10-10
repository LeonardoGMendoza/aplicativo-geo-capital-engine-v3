import symbolUrl from '@/assets/omni-symbol.svg'
import { cn } from '@/lib/utils'

/** Official raster artwork framed in SVG; no tracing or redesigned mark. */
export function BrandSymbol({ className, decorative = false }: { className?: string; decorative?: boolean }) {
  return <img src={symbolUrl} className={cn('shrink-0 object-contain', className)} alt={decorative ? '' : 'Símbolo oficial Omni-EcoRescue: escudo com folha'} aria-hidden={decorative || undefined} />
}

export function Brand() {
  return <div className="flex items-center gap-2 sm:gap-3">
    <BrandSymbol className="h-12 w-11 sm:h-14 sm:w-12" decorative />
    <div>
      <p className="text-xl font-bold tracking-tight text-white sm:text-[28px]">Omni-<span className="text-[#19dfba]">EcoRescue</span></p>
      <p className="mt-0.5 text-xs text-[#c9e5ed]">Dados e alertas para apoiar decisões.</p>
    </div>
  </div>
}
