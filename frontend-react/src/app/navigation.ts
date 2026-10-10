import { Building2, HeartHandshake, House, LayoutDashboard, LibraryBig, Map, BellRing, BrainCircuit, Settings } from 'lucide-react'

export const navigation = [
  { path: '/', label: 'Centro de Operações', icon: LayoutDashboard, description: '' },
  { path: '/mapa', label: 'Mapa de Riscos', icon: Map, description: 'Mapa territorial e camadas de contexto.' },
  { path: '/alertas', label: 'Alertas', icon: BellRing, description: 'Consulta e revisão de alertas.' },
  { path: '/corporativo', label: 'Visão Corporativa', icon: Building2, description: 'Cadastro de referência e triagem geográfica com eventos NASA.' },
  { path: '/comunidade', label: 'Impacto Social', icon: HeartHandshake, description: 'Contexto comunitário de referência e preparação geral.' },
  { path: '/abrigos', label: 'Evacuação e Abrigos', icon: House, description: 'Pontos de apoio, serviços essenciais e preparação.' },
  { path: '/inteligencia', label: 'Inteligência (IA)', icon: BrainCircuit, description: 'Recomendações que apoiam a decisão humana.' },
  { path: '/historico', label: 'Histórico e Relatórios', icon: LibraryBig, description: 'Consulta a documentos e referências para apoiar decisões.' },
  { path: '/configuracoes', label: 'Configurações', icon: Settings, description: 'Área reservada, sem configuração de integrações nesta etapa.' },
]
