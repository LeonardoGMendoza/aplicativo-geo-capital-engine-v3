import { useState } from 'react'
import { Activity, FlaskConical, Menu, PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { Link, NavLink, Outlet } from 'react-router-dom'
import { navigation } from '@/app/navigation'
import { Brand, BrandSymbol } from '@/components/shared/Brand'
import { ReferenceScene } from '@/components/shared/ReferenceScene'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { demoSnapshot, formatSnapshotTime } from '@/features/operations/data/demo'

function SidebarContent({ onNavigate, collapsed = false, onToggle }: { onNavigate?: () => void; collapsed?: boolean; onToggle?: () => void }) {
  return <div className="flex h-full flex-col">
    <nav aria-label="Navegação principal" className="flex-1 space-y-1 px-2 py-3">
      {navigation.map(({ path, label, icon: Icon }) => <NavLink key={path} to={path} end={path === '/'} onClick={onNavigate} title={collapsed ? label : undefined} aria-label={collapsed ? label : undefined} className={`sidebar-link ${collapsed ? 'justify-center' : ''}`}><Icon className="size-4 shrink-0" aria-hidden="true" /><span className={collapsed ? 'sr-only' : undefined}>{label}</span></NavLink>)}
    </nav>
    {onToggle && <Button variant="ghost" className="mx-2 mb-2 text-[#b4d3e1] hover:bg-white/10 hover:text-white" onClick={onToggle} aria-label={collapsed ? 'Expandir menu lateral' : 'Recolher menu lateral'} aria-expanded={!collapsed} title={collapsed ? 'Expandir menu lateral' : 'Recolher menu lateral'}>{collapsed ? <PanelLeftOpen /> : <><PanelLeftClose /><span className="text-xs">Recolher</span></>}</Button>}
    <div className={`mx-3 mb-5 flex items-center gap-2 border-t border-[#25617c] pt-4 ${collapsed ? 'justify-center' : ''}`}><BrandSymbol className="h-10 w-8" /><p className={collapsed ? 'sr-only' : 'text-xs font-semibold leading-relaxed text-white'}>TECH4CHANGE<br /><span className="font-normal text-[#a2c4d4]">A IA recomenda.<br />O humano decide.</span></p></div>
  </div>
}
export function AppLayout() {
  const [menuOpen, setMenuOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  return <div className="app-background min-h-screen">
    <a href="#main-content" className="fixed left-4 top-4 z-[60] -translate-y-28 rounded-lg bg-white p-3 text-[#064b63] focus:translate-y-0">Pular para o conteúdo</a>
    <header className="masthead flex flex-wrap items-center justify-between gap-3 px-3 py-3 sm:px-5">
      <ReferenceScene variant="panorama" className="masthead-scene h-full w-[55%]" />
      <div className="relative z-10 flex items-center gap-2">
        <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
          <SheetTrigger asChild><Button size="icon" variant="ghost" className="text-white hover:bg-white/10 hover:text-white lg:hidden" aria-label="Abrir menu de navegação"><Menu /></Button></SheetTrigger>
          <SheetContent side="left" className="sidebar w-72 gap-0 border-[#176286] p-0 text-white"><SheetHeader className="px-5 pb-3 pt-8"><SheetTitle className="text-white">Omni-EcoRescue</SheetTitle><SheetDescription className="text-[#b4d3e1]">Navegação do Centro de Operações.</SheetDescription></SheetHeader><SidebarContent onNavigate={() => setMenuOpen(false)} /></SheetContent>
        </Sheet>
        <Brand />
      </div>
      <p className="relative hidden items-center gap-3 text-xs tracking-[.22em] text-white xl:flex">TECNOLOGIA + PESSOAS = VIDAS MAIS SEGURAS<Activity className="size-6 text-[#2ce3c1]" aria-hidden="true" /></p>
      <div className="relative ml-auto flex items-center gap-3 text-xs">
        <FlaskConical className="size-5 text-[#20d8c1]" aria-hidden="true" />
        <div><time dateTime={demoSnapshot.timestamp}>{formatSnapshotTime(demoSnapshot.timestamp)} · Brasília</time><p className="mt-1 font-semibold text-[#39e6cb]">Referência do cenário demonstrativo</p></div>
        <span className="hidden size-8 items-center justify-center rounded-full border border-[#2089b0] bg-[#075778] font-semibold sm:flex" aria-label="Perfil demonstrativo">ES</span>
      </div>
    </header>
    <aside className={`sidebar fixed bottom-0 left-0 top-[88px] z-30 hidden lg:block ${sidebarCollapsed ? 'w-16' : 'w-40'}`}><SidebarContent collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed((value) => !value)} /></aside>
    <div className={sidebarCollapsed ? 'lg:pl-16' : 'lg:pl-40'}><main id="main-content" tabIndex={-1} className="operations-main outline-none"><Outlet /></main>
      <footer className="flex flex-wrap items-center justify-between gap-2 px-4 pb-4 text-xs text-[#9fc3d6]"><p>Omni-EcoRescue V3 · Tecnologia a serviço de pessoas e comunidades.</p><Link to="/" className="hover:text-white">Protótipo · dados NASA em área independente</Link></footer>
    </div>
  </div>
}
