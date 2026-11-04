// Guias de emergência para usar SEM INTERNET. Texto curto, em linguagem simples,
// resumido de orientações oficiais (fonte citada em cada guia). Não substitui a Defesa Civil.

export interface Guia {
  id: string
  emoji: string
  titulo: string
  resumo: string
  passos: string[]
  fonte: { nome: string; url: string }
}

export const guias: Guia[] = [
  {
    id: 'nuclear',
    emoji: '☢️',
    titulo: 'Emergência nuclear ou radiológica',
    resumo: 'Entre, fique dentro e acompanhe as informações oficiais.',
    passos: [
      'ENTRE: vá agora para dentro do prédio de alvenaria ou concreto mais próximo. Carro não protege.',
      'Fique no subsolo ou no meio do prédio, longe de portas, janelas e do telhado.',
      'FIQUE: permaneça dentro por pelo menos 24 horas, a não ser que a autoridade mande sair.',
      'Feche portas e janelas. Desligue ventiladores e ar-condicionado que puxam ar de fora.',
      'Se você estava na rua: tire a roupa de cima com cuidado e coloque num saco plástico fechado. Isso remove boa parte da contaminação.',
      'Tome banho com água morna e sabão; lave o cabelo com xampu, sem condicionador. Sem chuveiro, limpe a pele com pano úmido.',
      'Comida e água em embalagens fechadas podem ser consumidas. Traga os animais para dentro.',
      'ACOMPANHE: rádio a pilha, alerta oficial no celular e Defesa Civil. Iodeto de potássio só se a autoridade de saúde mandar.',
    ],
    fonte: { nome: 'Ready.gov (FEMA, EUA) – Radiation Emergencies', url: 'https://www.ready.gov/radiation' },
  },
  {
    id: 'guerra',
    emoji: '🚨',
    titulo: 'Ataque aéreo, bombardeio ou explosão',
    resumo: 'Ao ouvir sirene ou alerta: abrigue-se no lugar mais protegido, longe de vidros.',
    passos: [
      'Vá para o abrigo indicado pelas autoridades. Sem abrigo: subsolo ou um cômodo interno sem janelas, no andar mais baixo.',
      'Fique longe de janelas, vidros e paredes externas. Escadas e corredores internos costumam ser mais seguros.',
      'Na rua, sem abrigo por perto: deite no chão, de bruços, protegendo a cabeça e o pescoço com os braços.',
      'Leve o kit de emergência, documentos, remédios e água, se der tempo. Vidas primeiro, objetos depois.',
      'Depois da explosão: cuidado com prédios danificados, fios caídos e vazamento de gás. Não acenda fogo.',
      'NUNCA toque em objetos desconhecidos (bombas que não explodiram). Afaste-se e avise as autoridades.',
      'Combine com a família um ponto de encontro e um contato fora da cidade, caso a rede de celular caia.',
    ],
    fonte: { nome: 'Cruz Vermelha Internacional (CICV) e Defesa Civil', url: 'https://www.icrc.org/pt' },
  },
  {
    id: 'apagao',
    emoji: '🔦',
    titulo: 'Apagão longo (sem luz por dias)',
    resumo: 'Lanterna em vez de vela, geladeira fechada e dinheiro em espécie.',
    passos: [
      'Use lanterna, não vela: vela é a maior causa de incêndio em apagão.',
      'Mantenha a geladeira fechada: a comida aguenta cerca de 4 horas; o freezer cheio, cerca de 48 horas.',
      'Gerador ou fogareiro NUNCA dentro de casa ou na garagem fechada: o monóxido de carbono mata sem cheiro.',
      'Desligue aparelhos da tomada para não queimarem quando a luz voltar. Deixe uma lâmpada ligada para saber quando voltou.',
      'Tenha dinheiro em espécie: sem luz e sem internet, maquininha, Pix e caixa eletrônico podem não funcionar.',
      'Remédios que precisam de geladeira: combine antes com o médico ou a farmácia o que fazer.',
      'Economize o celular: brilho baixo, modo economia, dados desligados quando não precisar. Use rádio a pilha para notícias.',
    ],
    fonte: { nome: 'Ready.gov (FEMA, EUA) – Power Outages', url: 'https://www.ready.gov/power-outages' },
  },
  {
    id: 'enchente',
    emoji: '🌊',
    titulo: 'Enchente ou alagamento',
    resumo: 'Vá para um lugar alto e nunca atravesse água em movimento.',
    passos: [
      'Saia de áreas baixas e vá para um lugar alto. Se mandarem sair de casa, saia.',
      'Não atravesse água em movimento: cerca de 15 cm derrubam uma pessoa e 30 cm arrastam um carro.',
      'Se for seguro, desligue a energia e o gás antes de sair.',
      'Não encoste em fios caídos nem em água perto de rede elétrica.',
      'Água de enchente é contaminada: não beba e lave as mãos depois de qualquer contato.',
      'Em perigo, ligue 199 (Defesa Civil) ou 193 (Bombeiros).',
    ],
    fonte: { nome: 'Defesa Civil (gov.br) e Ready.gov – Floods', url: 'https://www.ready.gov/floods' },
  },
  {
    id: 'socorros',
    emoji: '🩹',
    titulo: 'Primeiros socorros básicos',
    resumo: 'Sangramento, queimadura, desmaio e parada cardíaca.',
    passos: [
      'Antes de ajudar, veja se o local é seguro para você.',
      'Sangramento: aperte firme com um pano limpo e não solte. Se encharcar, coloque outro por cima.',
      'Queimadura: água corrente fria por 20 minutos. Não use gelo, manteiga, pasta de dente nem pomada caseira.',
      'Desmaiada mas respirando: deite de lado (posição lateral de segurança) e observe a respiração.',
      'Não responde e não respira normalmente: peça ajuda (192) e comece compressões no centro do peito, fortes e rápidas (100 a 120 por minuto), até o socorro chegar.',
      'Engasgo em adulto que não consegue falar nem tossir: compressões abdominais (manobra de Heimlich).',
    ],
    fonte: { nome: 'Cruz Vermelha Brasileira e Cruz Vermelha Internacional', url: 'https://www.cruzvermelha.org.br' },
  },
  {
    id: 'emocional',
    emoji: '💚',
    titulo: 'Resiliência emocional na crise',
    resumo: 'Medo é normal. Respirar, cuidar do básico e ficar perto das pessoas ajuda a decidir melhor.',
    passos: [
      'Respire devagar: puxe o ar contando até 4 e solte contando até 6. Repita 5 vezes antes de decidir algo importante.',
      'Cuide do básico: água, comida, sono e remédios. O corpo cuidado ajuda a mente.',
      'Faça uma coisa de cada vez. Escreva a lista do que precisa ser feito hoje.',
      'Com crianças: fale a verdade com palavras simples, diga que os adultos estão cuidando delas e mantenha pequenas rotinas.',
      'Limite as notícias a poucos momentos do dia, de fontes oficiais. Boato aumenta o medo.',
      'Fique perto de pessoas e ajude alguém: servir ao próximo diminui a sensação de impotência.',
      'A fé, a oração e a comunidade sustentam muitas famílias em momentos assim.',
      'Se a angústia não passa ou alguém fala em tirar a própria vida: no Brasil, ligue 188 (CVV, gratuito, 24 horas).',
    ],
    fonte: { nome: 'OMS – Primeiros Cuidados Psicológicos', url: 'https://www.who.int/publications/i/item/9789241548205' },
  },
  {
    id: 'bateria',
    emoji: '🔋',
    titulo: 'Fazer o celular durar mais',
    resumo: 'Sem luz, a bateria vale ouro.',
    passos: [
      'Ative o modo economia de bateria e baixe o brilho da tela.',
      'Desligue Wi-Fi, Bluetooth e dados quando não estiver usando. Sem sinal, use o modo avião: procurar rede gasta muita bateria.',
      'Ligue o celular de hora em hora para ver mensagens, em vez de deixar ligado o tempo todo.',
      'Use este app: os guias e o seu plano funcionam sem internet.',
      'Mantenha um power bank carregado e, se puder, um carregador solar ou de manivela.',
      'Mande mensagem de texto (SMS) em vez de ligar: gasta menos e passa melhor quando a rede está congestionada.',
    ],
    fonte: { nome: 'Ready.gov (FEMA, EUA) – Power Outages', url: 'https://www.ready.gov/power-outages' },
  },
]

export interface NumeroEmergencia { numero: string; nome: string }
export const numerosPorPais: { pais: string; numeros: NumeroEmergencia[] }[] = [
  { pais: 'Brasil', numeros: [{ numero: '199', nome: 'Defesa Civil' }, { numero: '193', nome: 'Bombeiros' }, { numero: '192', nome: 'SAMU' }, { numero: '190', nome: 'Polícia' }, { numero: '188', nome: 'CVV' }] },
  { pais: 'Peru', numeros: [{ numero: '116', nome: 'Bomberos' }, { numero: '106', nome: 'SAMU' }, { numero: '105', nome: 'Policía' }] },
  { pais: 'Paraguai', numeros: [{ numero: '911', nome: 'Emergencias' }, { numero: '132', nome: 'Bomberos' }, { numero: '141', nome: 'Ambulancia' }] },
  { pais: 'Europa e muitos países', numeros: [{ numero: '112', nome: 'Emergência' }] },
  { pais: 'EUA e Canadá', numeros: [{ numero: '911', nome: 'Emergency' }] },
]
