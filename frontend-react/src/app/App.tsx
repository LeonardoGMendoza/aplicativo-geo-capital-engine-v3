import { Link, Route, Routes } from 'react-router-dom'
import { Construction } from 'lucide-react'
import { AppLayout } from '@/components/layout/AppLayout'
import { OperationsPage } from '@/features/operations/OperationsPage'
import { RiskMapPage } from '@/features/nasa/RiskMapPage'
import { CorporatePage } from '@/features/corporate/CorporatePage'
import { CommunityPage } from '@/features/community/CommunityPage'
import { SheltersPage } from '@/features/shelters/SheltersPage'
import { NasaSessionProvider } from '@/features/nasa/NasaSession'
import { navigation } from '@/app/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

function ReservedPage({ title, description }: { title: string; description: string }) {
  return (
    <div className="space-y-6">
      <div><p className="mb-2 text-xs font-medium text-[#25d3b6]">OMNI-ECORESCUE / V3</p><h1 className="text-3xl font-semibold tracking-tight text-white">{title}</h1><p className="mt-2 text-sm text-[#b5d2e2]">{description}</p></div>
      <Card><CardContent className="flex min-h-80 flex-col items-center justify-center p-8 text-center">
        <Construction className="mb-5 size-9 text-primary" aria-hidden="true" />
        <h2 className="text-lg font-semibold">Área reservada para a próxima etapa</h2>
        <p className="mb-6 mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">Este módulo ainda não está conectado a dados ou serviços. O Centro de Operações e o explorador em Mapa de Riscos estão disponíveis.</p>
        <Button asChild variant="outline"><Link to="/">Voltar ao Centro de Operações</Link></Button>
      </CardContent></Card>
    </div>
  )
}

export function App() {
  return (
    <NasaSessionProvider><Routes>
      <Route element={<AppLayout />}>
        <Route index element={<OperationsPage />} />
        <Route path="/mapa" element={<RiskMapPage />} />
        <Route path="/corporativo" element={<CorporatePage />} />
        <Route path="/comunidade" element={<CommunityPage />} />
        <Route path="/abrigos" element={<SheltersPage />} />
        {navigation.slice(1).filter(item => !['/mapa', '/corporativo', '/comunidade', '/abrigos'].includes(item.path)).map((item) => <Route key={item.path} path={item.path} element={<ReservedPage title={item.label} description={item.description} />} />)}
        <Route path="*" element={<ReservedPage title="Página não encontrada" description="Este endereço não corresponde a uma área do protótipo." />} />
      </Route>
    </Routes></NasaSessionProvider>
  )
}
