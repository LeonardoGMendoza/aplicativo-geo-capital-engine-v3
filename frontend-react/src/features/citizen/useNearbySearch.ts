import { useEffect, useRef, useState } from 'react'
import { geocode, getNearbyPlaces } from '../shelters/places'
import type { Coordinates, NearbyResponse } from '../shelters/places'

// Acima disso o navegador só adivinhou pela internet (ex.: centro da cidade): não buscar ali.
export const MAX_ACCURACY_M = 5000
export type SearchStatus = 'idle' | 'locating' | 'geocoding' | 'loading' | 'done' | 'error'

/** Busca de locais próximos para a tela do cidadão: GPS sob clique, endereço digitado ou ponto ajustado no mapa. */
export function useNearbySearch() {
  const [status, setStatus] = useState<SearchStatus>('idle')
  const [message, setMessage] = useState('')
  const [origin, setOrigin] = useState<{ coordinates: Coordinates; label: string } | null>(null)
  const [accuracy, setAccuracy] = useState<number | null>(null)
  const [data, setData] = useState<NearbyResponse | null>(null)
  const controller = useRef<AbortController | null>(null)
  useEffect(() => () => controller.current?.abort(), [])

  function next() { controller.current?.abort(); controller.current = new AbortController(); return controller.current.signal }

  async function searchAt(coordinates: Coordinates, label: string, meters: number | null = null, signal = next()) {
    setOrigin({ coordinates, label }); setAccuracy(meters); setStatus('loading'); setMessage(''); setData(null)
    try {
      const result = await getNearbyPlaces(coordinates, { signal })
      if (signal.aborted) return
      setData(result); setStatus('done')
    } catch (error) {
      if (signal.aborted) return
      setStatus('error')
      setMessage(error instanceof Error && error.name !== 'TimeoutError' ? error.message : 'A busca demorou demais. Tente de novo em instantes.')
    }
  }

  function locate() {
    if (!('geolocation' in navigator)) { setStatus('error'); setMessage('Este aparelho não informa a localização. Digite seu endereço.'); return }
    next(); setStatus('locating'); setMessage('')
    navigator.geolocation.getCurrentPosition(
      pos => {
        const meters = Number.isFinite(pos.coords.accuracy) ? Math.round(pos.coords.accuracy) : null
        if (meters !== null && meters > MAX_ACCURACY_M) {
          setData(null); setOrigin(null); setAccuracy(null); setStatus('error')
          setMessage(`Não foi possível achar sua posição exata (erro de ~${Math.round(meters / 1000)} km). Digite seu endereço abaixo.`)
          return
        }
        void searchAt({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }, 'Sua localização', meters)
      },
      err => {
        setStatus('error')
        setMessage(err.code === err.PERMISSION_DENIED
          ? 'Você não permitiu a localização. Digite seu endereço abaixo ou libere a localização nas configurações do navegador.'
          : 'Não foi possível obter sua localização. Digite seu endereço abaixo.')
      },
      { timeout: 12_000, enableHighAccuracy: true, maximumAge: 0 },
    )
  }

  async function searchAddress(text: string) {
    const signal = next()
    setStatus('geocoding'); setMessage('')
    try {
      const results = await geocode(text, { signal })
      if (signal.aborted) return
      if (!results.length) { setStatus('error'); setMessage('Endereço não encontrado. Tente rua, número e cidade.'); return }
      await searchAt(results[0].coordinates, results[0].displayName ?? results[0].name, null, signal)
    } catch (error) {
      if (signal.aborted) return
      setStatus('error'); setMessage(error instanceof Error ? error.message : 'Falha na busca.')
    }
  }

  const busy = status === 'locating' || status === 'geocoding' || status === 'loading'
  return { status, message, origin, accuracy, data, busy, locate, searchAddress, searchAt }
}
