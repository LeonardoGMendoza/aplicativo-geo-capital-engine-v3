import { Building2, HeartHandshake, House, LayoutDashboard, LibraryBig, Map, BellRing, BrainCircuit, CloudRain, QrCode, Settings } from 'lucide-react'

export const navigation = [
  { path: '/', label: 'Centro de Operações', icon: LayoutDashboard, description: '' },
  { path: '/mapa', label: 'Mapa de Riscos', icon: Map, description: 'Mapa territorial e camadas de contexto.' },
  { path: '/clima', label: 'Clima ao vivo', icon: CloudRain, description: 'Calor e chuva previstos, radar de chuva e alertas de desastres no mundo, com dados reais.' },
  { path: '/alertas', label: 'Alertas', icon: BellRing, description: 'Todos os alertas reais numa lista: previsão, satélite NASA e ONU, com orientação, IA e aviso por WhatsApp.' },
  { path: '/corporativo', label: 'Visão Corporativa', icon: Building2, description: 'Cadastro de referência e triagem geográfica com eventos NASA.' },
  { path: '/comunidade', label: 'Impacto Social', icon: HeartHandshake, description: 'Contexto comunitário de referência e preparação geral.' },
  { path: '/abrigos', label: 'Evacuação e Abrigos', icon: House, description: 'Pontos de apoio, serviços essenciais e preparação.' },
  { path: '/qrcode', label: 'QR Code do cidadão', icon: QrCode, description: 'Cartaz com QR code: o cidadão acha o abrigo mais perto e se cadastra para alertas no WhatsApp.' },
  { path: '/inteligencia', label: 'Inteligência (IA)', icon: BrainCircuit, description: 'Perguntas aos documentos oficiais com a IA da Oracle (RAG), citando PDF e página.' },
  { path: '/historico', label: 'Histórico e Relatórios', icon: LibraryBig, description: 'Consulta a documentos e referências para apoiar decisões.' },
  { path: '/configuracoes', label: 'Configurações', icon: Settings, description: 'Área reservada, sem configuração de integrações nesta etapa.' },
]

export const menuNavigation = navigation.filter(item => !['/historico', '/configuracoes'].includes(item.path))
