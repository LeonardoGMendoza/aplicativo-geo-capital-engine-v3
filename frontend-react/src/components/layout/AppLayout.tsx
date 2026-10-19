import { useEffect, useState } from 'react'
import { Activity, FlaskConical, Languages, MapPin, Menu, Smartphone, PanelLeftClose, PanelLeftOpen, Satellite } from 'lucide-react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { menuNavigation } from '@/app/navigation'
import { Brand, BrandSymbol } from '@/components/shared/Brand'
import { ReferenceScene } from '@/components/shared/ReferenceScene'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { demoSnapshot, formatSnapshotTime } from '@/features/operations/data/demo'
import { useNasaSession } from '@/features/nasa/NasaSession'
import { LanguageSelector } from '@/i18n'
import { RegiaoSelector } from '@/features/regiao/regiao'

function SidebarContent({ onNavigate, collapsed = false, onToggle }: { onNavigate?: () => void; collapsed?: boolean; onToggle?: () => void }) {
  return <div className="flex h-full flex-col">
    <nav aria-label="Navegação principal" className="flex-1 space-y-1 px-2 py-3">
      <p className={collapsed ? 'sr-only' : 'px-3 pb-1 text-[10px] font-semibold uppercase tracking-[.18em] text-[#7fb2c9]'}>Gestão · Defesa Civil</p>
      {menuNavigation.map(({ path, label, icon: Icon }) => <NavLink key={path} to={path} end={path === '/'} onClick={onNavigate} title={collapsed ? label : undefined} aria-label={collapsed ? label : undefined} className={`sidebar-link ${collapsed ? 'justify-center' : ''}`}><Icon className="size-4 shrink-0" aria-hidden="true" /><span className={collapsed ? 'sr-only' : undefined}>{label}</span></NavLink>)}
    {/* Área do cidadão separada da gestão (pedido da Defesa Civil): abre a tela simples do celular. */}
    <Link to="/cidadao" onClick={onNavigate} title={collapsed ? 'Área do cidadão' : undefined} aria-label={collapsed ? 'Área do cidadão' : undefined} className={`mt-3 flex items-center gap-2 rounded-md border border-[#20d8c1] bg-[#0b3b4f] px-3 py-2 text-sm font-semibold text-[#2ce3c1] hover:bg-[#0f4a62] ${collapsed ? 'justify-center' : ''}`}><Smartphone className="size-4 shrink-0" aria-hidden="true" /><span className={collapsed ? 'sr-only' : undefined}>Área do cidadão</span></Link>
    <label title={collapsed ? 'Idioma / Language' : undefined} className={`relative mt-3 border-t border-[#25617c] flex items-center gap-2 rounded-md px-3 pt-3 pb-2 text-[#b4d3e1] hover:bg-white/10 hover:text-white ${collapsed ? 'justify-center' : ''}`}>
      <Languages className="size-4 shrink-0" aria-hidden="true" />
      <LanguageSelector className={collapsed ? 'absolute inset-0 cursor-pointer opacity-0' : 'w-full min-w-0 cursor-pointer rounded border border-[#25617c] bg-[#06283a] px-1 py-1 text-xs text-white'} />
    </label>
    </nav>
    {onToggle && <Button variant="ghost" className="mx-2 mb-2 text-[#b4d3e1] hover:bg-white/10 hover:text-white" onClick={onToggle} aria-label={collapsed ? 'Expandir menu lateral' : 'Recolher menu lateral'} aria-expanded={!collapsed} title={collapsed ? 'Expandir menu lateral' : 'Recolher menu lateral'}>{collapsed ? <PanelLeftOpen /> : <><PanelLeftClose /><span className="text-xs">Recolher</span></>}</Button>}
    <div className={`mx-3 mb-5 flex items-center gap-2 border-t border-[#25617c] pt-4 ${collapsed ? 'justify-center' : ''}`}><BrandSymbol className="h-10 w-8" /><p className={collapsed ? 'sr-only' : 'text-xs font-semibold leading-relaxed text-white'}>TECH4CHANGE<br /><span className="font-normal text-[#a2c4d4]">Dados em contexto.<br />O humano decide.</span></p></div>
  </div>
}
/** Canto do cabeçalho: no modo real mostra o relógio de agora; a data fixa do cenário fictício só aparece no Modo demonstração. */
function HoraDoCabecalho() {
  const { mode } = useNasaSession()
  const [agora, setAgora] = useState(() => new Date().toISOString())
  useEffect(() => { const t = setInterval(() => setAgora(new Date().toISOString()), 30000); return () => clearInterval(t) }, [])
  if (mode === 'simulation') return <><FlaskConical className="size-5 text-[#20d8c1]" aria-hidden="true" />
    <div><time dateTime={demoSnapshot.timestamp}>{formatSnapshotTime(demoSnapshot.timestamp)} · Brasília</time><p className="mt-1 font-semibold text-[#39e6cb]">Referência do cenário demonstrativo</p></div></>
  return <><Satellite className="size-5 text-[#20d8c1]" aria-hidden="true" />
    <div><time dateTime={agora}>Agora · {formatSnapshotTime(agora)} · Brasília</time><p className="mt-1 font-semibold text-[#39e6cb]">Dados reais, consultados agora</p></div></>
}

export function AppLayout() {
  const location = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  useEffect(() => {
    if (location.pathname !== '/' || location.hash !== '#central-alertas' || menuOpen) return
    const frame = requestAnimationFrame(() => {
      const central = document.getElementById('central-alertas')
      central?.scrollIntoView({ block: 'start' })
      central?.focus({ preventScroll: true })
    })
    return () => cancelAnimationFrame(frame)
  }, [location.pathname, location.hash, location.key, menuOpen])
  return <div className="app-background min-h-screen">
    <a href="#main-content" className="fixed left-4 top-4 z-[60] -translate-y-28 rounded-lg bg-white p-3 text-[#064b63] focus:translate-y-0">Pular para o conteúdo</a>
    <header className="masthead flex flex-wrap items-center justify-between gap-3 px-3 py-3 sm:px-5">
      <ReferenceScene variant="panorama" className="masthead-scene h-full w-[55%]" />
      <div className="relative z-10 flex items-center gap-2">
        <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
          <SheetTrigger asChild><Button size="icon" variant="ghost" className="text-white hover:bg-white/10 hover:text-white lg:hidden" aria-label="Abrir menu de navegação"><Menu /></Button></SheetTrigger>
          <SheetContent onCloseAutoFocus={event => { if (location.hash === '#central-alertas') event.preventDefault() }} side="left" className="sidebar w-72 gap-0 border-[#176286] p-0 text-white"><SheetHeader className="px-5 pb-3 pt-8"><SheetTitle className="text-white">Omni-EcoRescue</SheetTitle><SheetDescription className="text-[#b4d3e1]">Navegação do Centro de Operações.</SheetDescription></SheetHeader><SidebarContent onNavigate={() => setMenuOpen(false)} /></SheetContent>
        </Sheet>
        <Brand />
      </div>
      <p className="relative hidden items-center gap-3 text-xs tracking-[.22em] text-white xl:flex">DADOS + CONTEXTO = APOIO À DECISÃO<Activity className="size-6 text-[#2ce3c1]" aria-hidden="true" /></p>
      <div className="relative ml-auto flex items-center gap-3 text-xs">
        <label className="flex items-center gap-1 rounded-md border border-[#2089b0] bg-[#075778] px-2 py-1" title="Região mostrada nos alertas, no clima e nos mapas">
          <MapPin className="size-4 text-[#20d8c1]" aria-hidden="true" />
          <RegiaoSelector className="cursor-pointer bg-transparent text-xs font-semibold text-white outline-none [&>option]:bg-[#06283a]" />
        </label>
        <HoraDoCabecalho />
        <span className="hidden size-8 items-center justify-center rounded-full border border-[#2089b0] bg-[#075778] font-semibold sm:flex" aria-label="Perfil demonstrativo">ES</span>
      </div>
    </header>
    <aside className={`sidebar fixed bottom-0 left-0 top-[88px] z-30 hidden lg:block ${sidebarCollapsed ? 'w-16' : 'w-40'}`}><SidebarContent collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed((value) => !value)} /></aside>
    <div className={sidebarCollapsed ? 'lg:pl-16' : 'lg:pl-40'}><main id="main-content" tabIndex={-1} className="operations-main outline-none"><Outlet /></main>
      <footer className="flex flex-wrap items-center justify-between gap-2 px-4 pb-4 text-xs text-[#9fc3d6]"><p>Omni-EcoRescue V3 · Tecnologia a serviço de pessoas e comunidades.</p><Link to="/" className="hover:text-white">Protótipo · dados NASA em área independente</Link></footer>
    </div>
  </div>
}
