// Kit de emergência da família: 72 horas (União Europeia, Países Baixos), 10 dias (Alemanha) ou 30 dias.
// Água: cerca de 4 litros por pessoa por dia (beber e higiene mínima), como recomenda o Ready.gov (1 galão).

export const DURACOES = [3, 10, 30] as const
export type Duracao = typeof DURACOES[number]

export interface ItemKit { id: string; grupo: string; texto: string }

export function itensDoKit(pessoas: number, dias: number, opcoes: { bebe?: boolean; idoso?: boolean; pet?: boolean } = {}): ItemKit[] {
  const p = Math.max(1, Math.min(20, Math.round(pessoas) || 1))
  const d = Math.max(1, Math.min(90, Math.round(dias) || 3))
  const litros = p * d * 4
  const refeicoes = p * d * 3
  const itens: ItemKit[] = [
    { id: 'agua', grupo: 'Água e comida', texto: `${litros} litros de água potável (${p} pessoa${p > 1 ? 's' : ''} × ${d} dias × 4 L)` },
    { id: 'comida', grupo: 'Água e comida', texto: `${refeicoes} refeições que não precisam de geladeira (enlatados, grãos, macarrão, leite em pó, barras)` },
    { id: 'abridor', grupo: 'Água e comida', texto: 'Abridor de lata manual, pratos, copos e talheres' },
    { id: 'remedios', grupo: 'Saúde', texto: `Remédios de uso contínuo para ${d} dias ou mais, com as receitas` },
    { id: 'socorros', grupo: 'Saúde', texto: 'Kit de primeiros socorros (gaze, esparadrapo, antisséptico, analgésico, luvas)' },
    { id: 'higiene', grupo: 'Saúde', texto: 'Sabonete, álcool em gel, papel higiênico, absorventes, sacos de lixo' },
    { id: 'mascaras', grupo: 'Saúde', texto: 'Máscaras (fumaça, poeira) e fita adesiva larga com plástico para vedar janelas' },
    { id: 'lanterna', grupo: 'Luz e energia', texto: `${Math.max(1, Math.ceil(p / 2))} lanterna(s) e pilhas reserva (sem velas)` },
    { id: 'radio', grupo: 'Luz e energia', texto: 'Rádio AM/FM a pilha ou de manivela, para ouvir os alertas oficiais' },
    { id: 'powerbank', grupo: 'Luz e energia', texto: 'Power bank carregado e cabos (ideal: carregador solar)' },
    { id: 'dinheiro', grupo: 'Documentos e dinheiro', texto: 'Dinheiro em espécie, em notas pequenas: sem luz, cartão e Pix podem não funcionar' },
    { id: 'documentos', grupo: 'Documentos e dinheiro', texto: 'Cópias dos documentos, receitas e contatos num saco plástico fechado' },
    { id: 'mapa', grupo: 'Documentos e dinheiro', texto: 'Mapa de papel da cidade com o ponto de encontro marcado' },
    { id: 'roupa', grupo: 'Abrigo', texto: 'Agasalho, cobertor ou manta térmica e calçado firme para cada pessoa' },
    { id: 'apito', grupo: 'Abrigo', texto: 'Apito para pedir socorro' },
  ]
  if (opcoes.bebe) itens.push({ id: 'bebe', grupo: 'Família', texto: `Fraldas, leite e mamadeira para ${d} dias` })
  if (opcoes.idoso) itens.push({ id: 'idoso', grupo: 'Família', texto: 'Óculos e aparelho auditivo reserva, bengala e lista de remédios do idoso' })
  if (opcoes.pet) itens.push({ id: 'pet', grupo: 'Família', texto: `Ração e água para o animal por ${d} dias, coleira e caixa de transporte` })
  return itens
}

export function progresso(itens: ItemKit[], marcados: ReadonlySet<string>) {
  const feitos = itens.filter(i => marcados.has(i.id)).length
  return { feitos, total: itens.length, pct: itens.length ? Math.round((feitos / itens.length) * 100) : 0 }
}
