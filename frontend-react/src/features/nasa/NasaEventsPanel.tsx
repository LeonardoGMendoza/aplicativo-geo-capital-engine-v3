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
      <div className="flex flex-wrap gap-2"><Button size="sm" variant={mode === 'simulation' ? 'default' : 'outline'} aria-pressed={mode === 'simulation'} onClick={() => setMode('simulation')}>Modo demonstração</Button><Button size="sm" variant={mode === 'nasa' ? 'default' : 'outline'} aria-pressed={mode === 'nasa'} onClick={() => setMode('nasa')}>Dados reais (NASA)</Button>{mode === 'nasa' && <Button size="sm" variant="outline" disabled={loading} onClick={refresh}>Atualizar consulta</Button>}</div>
    </div>
    {mode === 'simulation' ? <p className="mt-2 text-muted-foreground">SIMULAÇÃO · Dashboard com dados fictícios. Nenhuma consulta NASA é executada neste modo.</p> : <>
      <p className="mt-2 text-sm"><span className="mr-2 rounded bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800">DADOS REAIS</span>Eventos que os satélites da NASA estão vendo agora no mundo. Clique numa bolinha ou na lista para ver e avisar a comunidade.</p>
      {loading && <p role="status" className="mt-3">Consultando NASA pelo backend…</p>}
      {error && <p role="alert" className="mt-3 rounded border border-amber-300 bg-amber-50 p-3 text-amber-950">{error} O modo de simulação continua disponível.</p>}
      {!loading && result && <div className="mt-3 space-y-2">
        {result.state !== 'success' && <p role={result.state === 'error' || result.state === 'unavailable' ? 'alert' : 'status'} className="font-semibold">{labels[result.state]}{result.error ? ` · ${result.error.message}` : ''}</p>}
        <details className="text-muted-foreground"><summary className="cursor-pointer">Sobre estes dados · atualizado {formatTime(result.fetchedAt)}</summary><p>Origem: {result.source} · eventos abertos no mundo. Eventos NASA não determinam risco local; o Centro de Operações usa estes eventos junto com a previsão do tempo, os alertas da ONU (GDACS) e os abrigos do OpenStreetMap. Decisões exigem confirmação humana.</p>{result.dataQuality === 'partial' && <p>Dados parciais: há eventos sem localização, categoria ou horário recente. Não são convertidos em alertas.</p>}<p>Categorias: {result.query.category} · consulta: {formatTime(result.queriedAt)} · cache: {result.cache === 'fresh' ? 'válido' : result.cache === 'stale' ? 'desatualizado' : result.cache === 'miss' ? 'nova obtenção' : 'sem dados utilizáveis'}.</p><p>Estado registrado na consulta, sem atualização automática. Obtenção não equivale à observação de cada evento. Observação antiga segue o limiar definido pelo servidor.</p></details>
        {result.state === 'empty' && <p>Nenhum evento retornado nas categorias consultadas. Isso não indica ausência de risco.</p>}
        {result.state === 'stale' && <p className="font-medium text-amber-900">Última resposta conhecida exibida como desatualizada, inclusive se vazia. Atualize antes de utilizar os dados.</p>}
        {(result.state === 'error' || result.state === 'unavailable') && <p>A situação não pode ser avaliada com esta consulta. Isso não indica ausência de risco. Use a simulação para explorar a interface.</p>}
        <NasaMapExplorer events={result.events} />
      </div>}
    </>}
  </section>
}
