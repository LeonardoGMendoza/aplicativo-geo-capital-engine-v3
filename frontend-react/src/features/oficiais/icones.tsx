import type { LucideIcon } from 'lucide-react'
import { Activity, CloudLightning, CloudRain, Droplets, Flame, Radiation, Snowflake, Thermometer, Tornado, TriangleAlert, WavesArrowUp, Wind } from 'lucide-react'

/** Ícone de linha (sem emoji) para o tipo do aviso. */
export function IconeEvento({ evento, className }: { evento: string | null; className?: string }) {
  const t = (evento ?? '').toLowerCase()
  const I: LucideIcon = /tornado/.test(t) ? Tornado : /tsunami/.test(t) ? WavesArrowUp : /terremoto|sismo|earthquake/.test(t) ? Activity
    : /neve|nevasca|frio|geada|snow|cold/.test(t) ? Snowflake : /calor|heat|umidade/.test(t) ? Thermometer : /incênd|fire/.test(t) ? Flame
    : /nuclear|radiol/.test(t) ? Radiation : /enchente|enxurrada|inunda|flood/.test(t) ? Droplets : /chuva|rain/.test(t) ? CloudRain
    : /tempestade|trovoada|storm|thunder/.test(t) ? CloudLightning : /vento|vendaval|wind/.test(t) ? Wind : TriangleAlert
  return <I className={className} aria-hidden="true" />
}

