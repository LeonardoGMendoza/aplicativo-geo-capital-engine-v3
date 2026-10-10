import { useNasaSession } from './NasaSession'
import { Satellite } from 'lucide-react'
import { Button } from '@/components/ui/button'


import { NasaMapExplorer } from './NasaMapExplorer'

const labels = { success: 'Consulta bem-sucedida', empty: 'Consulta bem-sucedida sem eventos', stale: 'Dados de cache desatualizados', unavailable: 'Dados indisponíveis', error: 'Falha na integração' }
function formatTime(value: string | null) {
  return value ? new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Sao_Paulo' }).format(new Date(value)) + ' · Brasília' : 'Não informado'
}
export function NasaEventsPanel() {
  const { mode, setMode, result, loading, error, refresh } = useNasaSession()
  return <section aria-label="Consulta NASA EONET" className="light-panel mb-3 p-3 text-xs">
    <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="flex items-center gap-2 font-semibold"><Satellite className="size-4 text-primary" />Catálogo de eventos · NASA EONET</h2>
      <div className="flex flex-wrap gap-2"><Button size="sm" variant={mode === 'simulation' ? 'default' : 'outline'} aria-pressed={mode === 'simulation'} onClick={() => setMode('simulation')}>Simulação</Button><Button size="sm" variant={mode === 'nasa' ? 'default' : 'outline'} aria-pressed={mode === 'nasa'} onClick={() => setMode('nasa')}>Consultar NASA</Button>{mode === 'nasa' && <Button size="sm" variant="outline" disabled={loading} onClick={refresh}>Atualizar consulta</Button>}</div>
    </div>
    {mode === 'simulation' ? <p className="mt-2 text-muted-foreground">SIMULAÇÃO · Dashboard com dados fictícios. Nenhuma consulta NASA é executada neste modo.</p> : <>
      <p className="mt-2 text-muted-foreground">Eventos NASA não determinam risco local. Este mapa é geográfico; indicadores e abrigos do Centro de Operações continuam em SIMULAÇÃO. Nenhuma rota segura ou operação é definida. Decisões futuras exigem confirmação humana.</p>
      {loading && <p role="status" className="mt-3">Consultando NASA pelo backend…</p>}
      {error && <p role="alert" className="mt-3 rounded border border-amber-300 bg-amber-50 p-3 text-amber-950">{error} O modo de simulação continua disponível.</p>}
      {!loading && result && <div className="mt-3 space-y-2">
        <p role={result.state === 'error' || result.state === 'unavailable' ? 'alert' : 'status'} className="font-semibold">{labels[result.state]}{result.error ? ` · ${result.error.message}` : ''}</p>
        <p>Origem: {result.source} · obtenção: {formatTime(result.fetchedAt)} · eventos abertos globais.</p>
        <details className="text-muted-foreground"><summary className="cursor-pointer">Detalhes da consulta e horários</summary><p>Categorias: {result.query.category} · consulta: {formatTime(result.queriedAt)} · cache: {result.cache === 'fresh' ? 'válido' : result.cache === 'stale' ? 'desatualizado' : result.cache === 'miss' ? 'nova obtenção' : 'sem dados utilizáveis'}.</p><p>Estado registrado na consulta, sem atualização automática. Obtenção não equivale à observação de cada evento. Observação antiga segue o limiar definido pelo servidor.</p></details>
        {result.state === 'empty' && <p>Nenhum evento retornado nas categorias consultadas. Isso não indica ausência de risco.</p>}
        {result.state === 'stale' && <p className="font-medium text-amber-900">Última resposta conhecida exibida como desatualizada, inclusive se vazia. Atualize antes de utilizar os dados.</p>}
        {(result.state === 'error' || result.state === 'unavailable') && <p>A situação não pode ser avaliada com esta consulta. Isso não indica ausência de risco. Use a simulação para explorar a interface.</p>}
        {result.dataQuality === 'partial' && <p className="text-amber-900">Dados parciais: há eventos sem localização, categoria ou horário recente. Não são convertidos em alertas.</p>}
        <NasaMapExplorer events={result.events} />
      </div>}
    </>}
  </section>
}
