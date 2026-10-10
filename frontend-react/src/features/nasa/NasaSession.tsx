import { createContext, useContext, useEffect, useState } from 'react'
import type { Dispatch, ReactNode, SetStateAction } from 'react'
import type { EventsResponse } from './contracts'
import { getEvents } from './client'
type Setter<T> = Dispatch<SetStateAction<T>>
interface Session {
  mode: 'simulation' | 'nasa'; setMode: Setter<'simulation' | 'nasa'>
  result: EventsResponse | null; loading: boolean; error: string | null; refresh: () => void
  category: string; setCategory: Setter<string>; search: string; setSearch: Setter<string>
  selectedId: string | null; setSelectedId: Setter<string | null>; page: number; setPage: Setter<number>
}
const Context = createContext<Session | null>(null)
export function NasaSessionProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<'simulation' | 'nasa'>('simulation')
  const [attempt, setAttempt] = useState(0)
  const [result, setResult] = useState<EventsResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [category, setCategory] = useState('all')
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [page, setPage] = useState(0)
  useEffect(() => {
    if (mode === 'simulation') { setLoading(false); return }
    const controller = new AbortController()
    setLoading(true); setError(null); setResult(null)
    getEvents({ baseUrl: import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000', signal: controller.signal })
      .then(data => { if (!controller.signal.aborted) setResult(data) })
      .catch(() => { if (!controller.signal.aborted) setError('Não foi possível obter dados válidos da API. Verifique o backend e tente novamente. Ausência de resposta não significa ausência de risco.') })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [mode, attempt])
  return <Context.Provider value={{ mode, setMode, result, loading, error, refresh: () => { setMode('nasa'); setAttempt(value => value + 1) }, category, setCategory, search, setSearch, selectedId, setSelectedId, page, setPage }}>{children}</Context.Provider>
}
export function useNasaSession() {
  const session = useContext(Context)
  if (!session) throw new Error('NASA session provider is required')
  return session
}
