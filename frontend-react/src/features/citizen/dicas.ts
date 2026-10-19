// Dicas rápidas por tipo de evento para a tela do cidadão (pedido da Defesa Civil).
// Orientações gerais de prevenção, no estilo das campanhas da Defesa Civil; não substituem o 199 nem o 193.
export type Dica = { id: string; emoji: string; titulo: string; itens: string[] }

export const dicas: Dica[] = [
  {
    id: 'chuva', emoji: '🌧️', titulo: 'Chuva forte e alagamento',
    itens: [
      'Não atravesse rua alagada, nem a pé nem de carro: pouca água correndo já derruba uma pessoa e arrasta um carro.',
      'Fique longe de córregos, rios, bueiros e encostas.',
      'Se a água entrar em casa, desligue a energia elétrica no quadro de luz.',
      'Vá para um lugar alto e seguro. Se precisar sair, leve documentos, remédios e o celular carregado.',
      'Evite contato com a água da enchente: ela pode transmitir doenças como a leptospirose.',
    ],
  },
  {
    id: 'deslizamento', emoji: '⛰️', titulo: 'Deslizamento de terra',
    itens: [
      'Sinais de perigo: rachaduras novas nas paredes, portas e janelas emperrando, árvores ou postes inclinados, barulho de terra.',
      'Viu algum sinal? Saia de casa na hora e avise os vizinhos.',
      'Não volte para buscar objetos.',
      'Ligue 199 (Defesa Civil) ou 193 (Bombeiros).',
    ],
  },
  {
    id: 'raios', emoji: '⚡', titulo: 'Raios e vendaval',
    itens: [
      'Não fique embaixo de árvores, postes, placas ou fios.',
      'Fique dentro de casa ou de um carro fechado, longe de janelas.',
      'Em área aberta, não use guarda-chuva nem segure objetos de metal.',
      'Saia de piscinas, praias e campos abertos.',
      'Tire da tomada os aparelhos elétricos.',
    ],
  },
  {
    id: 'calor', emoji: '🌡️', titulo: 'Calor intenso',
    itens: [
      'Beba água mesmo sem sede.',
      'Evite o sol entre 10h e 16h.',
      'Atenção redobrada com idosos, crianças e pessoas doentes.',
      'Use roupas leves e procure lugares frescos e à sombra.',
    ],
  },
]

/** Tempo aproximado a pé (≈ 4,5 km/h) para a distância em linha reta. */
export function minutosAPe(km: number) {
  return Math.max(1, Math.round((km / 4.5) * 60))
}
