// Gerador de QR Code próprio (sem biblioteca externa), seguindo a norma ISO/IEC 18004.
// Baseado no algoritmo público de referência de Project Nayuki (licença MIT), reduzido ao necessário:
// modo byte (UTF-8), versões 1 a 10 (até ~200 caracteres com nível M), escolha de máscara por penalidade.
export type NivelCorrecao = 'L' | 'M' | 'Q' | 'H'

const ORDEM: Record<NivelCorrecao, number> = { L: 0, M: 1, Q: 2, H: 3 }
const BITS_FORMATO: Record<NivelCorrecao, number> = { L: 1, M: 0, Q: 3, H: 2 }
const ECC_POR_BLOCO = [
  [-1, 7, 10, 15, 20, 26, 18, 20, 24, 30, 18],
  [-1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26],
  [-1, 13, 22, 18, 26, 18, 24, 18, 22, 20, 24],
  [-1, 17, 28, 22, 16, 22, 28, 26, 26, 24, 28],
]
const NUM_BLOCOS = [
  [-1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 4],
  [-1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5],
  [-1, 1, 1, 2, 2, 4, 4, 6, 6, 8, 8],
  [-1, 1, 1, 2, 4, 4, 4, 5, 6, 8, 8],
]
const VERSAO_MAX = 10

const bit = (x: number, i: number) => ((x >>> i) & 1) !== 0

function modulosBrutos(ver: number) {
  let r = (16 * ver + 128) * ver + 64
  if (ver >= 2) {
    const na = Math.floor(ver / 7) + 2
    r -= (25 * na - 10) * na - 55
    if (ver >= 7) r -= 36
  }
  return r
}
const palavrasDeDados = (ver: number, n: NivelCorrecao) =>
  Math.floor(modulosBrutos(ver) / 8) - ECC_POR_BLOCO[ORDEM[n]][ver] * NUM_BLOCOS[ORDEM[n]][ver]

// Reed-Solomon sobre GF(2^8) com polinômio 0x11D
function mult(x: number, y: number) {
  let z = 0
  for (let i = 7; i >= 0; i--) {
    z = (z << 1) ^ ((z >>> 7) * 0x11d)
    z ^= ((y >>> i) & 1) * x
  }
  return z
}
function divisor(grau: number) {
  const r = new Array<number>(grau).fill(0)
  r[grau - 1] = 1
  let raiz = 1
  for (let i = 0; i < grau; i++) {
    for (let j = 0; j < r.length; j++) {
      r[j] = mult(r[j], raiz)
      if (j + 1 < r.length) r[j] ^= r[j + 1]
    }
    raiz = mult(raiz, 0x02)
  }
  return r
}
function resto(dados: number[], div: number[]) {
  const r = new Array<number>(div.length).fill(0)
  for (const b of dados) {
    const fator = b ^ (r.shift() as number)
    r.push(0)
    div.forEach((c, i) => { r[i] ^= mult(c, fator) })
  }
  return r
}

function utf8(texto: string) { return Array.from(new TextEncoder().encode(texto)) }

/** Matriz do QR (true = módulo escuro). Lança erro se o texto for grande demais para a versão 10. */
export function gerarQr(texto: string, nivel: NivelCorrecao = 'M'): boolean[][] {
  const bytes = utf8(texto)
  let ver = 1
  for (; ver <= VERSAO_MAX; ver++) {
    const bitsContagem = ver <= 9 ? 8 : 16
    if (4 + bitsContagem + bytes.length * 8 <= palavrasDeDados(ver, nivel) * 8) break
  }
  if (ver > VERSAO_MAX) throw new Error('Texto grande demais para o QR')

  // Fluxo de bits: modo byte (0100), contagem, dados, terminador e preenchimento
  const bits: number[] = []
  const por = (valor: number, n: number) => { for (let i = n - 1; i >= 0; i--) bits.push((valor >>> i) & 1) }
  por(0x4, 4); por(bytes.length, ver <= 9 ? 8 : 16); bytes.forEach(b => por(b, 8))
  const capacidade = palavrasDeDados(ver, nivel) * 8
  por(0, Math.min(4, capacidade - bits.length))
  por(0, (8 - (bits.length % 8)) % 8)
  for (let pad = 0xec; bits.length < capacidade; pad ^= 0xec ^ 0x11) por(pad, 8)
  const dados: number[] = []
  for (let i = 0; i < bits.length; i += 8) dados.push(bits.slice(i, i + 8).reduce((a, b) => (a << 1) | b, 0))

  // Blocos com correção de erro, intercalados
  const nBlocos = NUM_BLOCOS[ORDEM[nivel]][ver], eccLen = ECC_POR_BLOCO[ORDEM[nivel]][ver]
  const brutos = Math.floor(modulosBrutos(ver) / 8)
  const curtos = nBlocos - (brutos % nBlocos), tamCurto = Math.floor(brutos / nBlocos)
  const div = divisor(eccLen)
  const blocos: number[][] = []
  for (let i = 0, k = 0; i < nBlocos; i++) {
    const dat = dados.slice(k, k + tamCurto - eccLen + (i < curtos ? 0 : 1))
    k += dat.length
    const ecc = resto(dat, div)
    if (i < curtos) dat.push(0)
    blocos.push(dat.concat(ecc))
  }
  const palavras: number[] = []
  for (let i = 0; i < blocos[0].length; i++)
    blocos.forEach((b, j) => { if (i !== tamCurto - eccLen || j >= curtos) palavras.push(b[i]) })

  // Matriz e padrões fixos
  const n = ver * 4 + 17
  const mod = Array.from({ length: n }, () => new Array<boolean>(n).fill(false))
  const fixo = Array.from({ length: n }, () => new Array<boolean>(n).fill(false))
  const fixar = (x: number, y: number, escuro: boolean) => { mod[y][x] = escuro; fixo[y][x] = true }
  for (let i = 0; i < n; i++) { fixar(6, i, i % 2 === 0); fixar(i, 6, i % 2 === 0) }
  for (const [cx, cy] of [[3, 3], [n - 4, 3], [3, n - 4]]) {
    for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
      const d = Math.max(Math.abs(dx), Math.abs(dy)), x = cx + dx, y = cy + dy
      if (x >= 0 && x < n && y >= 0 && y < n) fixar(x, y, d !== 2 && d !== 4)
    }
  }
  const alin: number[] = []
  if (ver > 1) {
    const na = Math.floor(ver / 7) + 2
    const passo = Math.ceil((ver * 4 + 4) / (na * 2 - 2)) * 2
    alin.push(6)
    for (let p = n - 7; alin.length < na; p -= passo) alin.splice(1, 0, p)
  }
  alin.forEach((ax, i) => alin.forEach((ay, j) => {
    if ((i === 0 && j === 0) || (i === 0 && j === alin.length - 1) || (i === alin.length - 1 && j === 0)) return
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) fixar(ax + dx, ay + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1)
  }))
  const formato = (mascara: number) => {
    const d = (BITS_FORMATO[nivel] << 3) | mascara
    let r = d
    for (let i = 0; i < 10; i++) r = (r << 1) ^ ((r >>> 9) * 0x537)
    const b = ((d << 10) | r) ^ 0x5412
    for (let i = 0; i <= 5; i++) fixar(8, i, bit(b, i))
    fixar(8, 7, bit(b, 6)); fixar(8, 8, bit(b, 7)); fixar(7, 8, bit(b, 8))
    for (let i = 9; i < 15; i++) fixar(14 - i, 8, bit(b, i))
    for (let i = 0; i < 8; i++) fixar(n - 1 - i, 8, bit(b, i))
    for (let i = 8; i < 15; i++) fixar(8, n - 15 + i, bit(b, i))
    fixar(8, n - 8, true)
  }
  formato(0)
  if (ver >= 7) {
    let r = ver
    for (let i = 0; i < 12; i++) r = (r << 1) ^ ((r >>> 11) * 0x1f25)
    const b = (ver << 12) | r
    for (let i = 0; i < 18; i++) {
      const a = n - 11 + (i % 3), c = Math.floor(i / 3)
      fixar(a, c, bit(b, i)); fixar(c, a, bit(b, i))
    }
  }

  // Dados em zigue-zague
  let i = 0
  for (let dir = n - 1; dir >= 1; dir -= 2) {
    if (dir === 6) dir = 5
    for (let v = 0; v < n; v++) for (let j = 0; j < 2; j++) {
      const x = dir - j, subindo = ((dir + 1) & 2) === 0, y = subindo ? n - 1 - v : v
      if (!fixo[y][x] && i < palavras.length * 8) { mod[y][x] = bit(palavras[i >>> 3], 7 - (i & 7)); i++ }
    }
  }

  // Máscara: testa as 8 e fica com a de menor penalidade
  const inverte = (m: number, x: number, y: number) => [
    (x + y) % 2 === 0, y % 2 === 0, x % 3 === 0, (x + y) % 3 === 0,
    (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0, ((x * y) % 2) + ((x * y) % 3) === 0,
    (((x * y) % 2) + ((x * y) % 3)) % 2 === 0, (((x + y) % 2) + ((x * y) % 3)) % 2 === 0,
  ][m]
  const aplicar = (m: number) => { for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (!fixo[y][x] && inverte(m, x, y)) mod[y][x] = !mod[y][x] }
  let melhor = 0, menor = Infinity
  for (let m = 0; m < 8; m++) {
    aplicar(m); formato(m)
    const p = penalidade(mod)
    if (p < menor) { menor = p; melhor = m }
    aplicar(m) // desfaz (XOR)
  }
  aplicar(melhor); formato(melhor)
  return mod
}

function penalidade(m: boolean[][]) {
  const n = m.length
  let p = 0, escuros = 0
  for (let y = 0; y < n; y++) {
    for (const linha of [m[y].map((_, x) => m[y][x]), m.map(l => l[y])]) {
      let run = 1
      for (let x = 1; x <= n; x++) {
        if (x < n && linha[x] === linha[x - 1]) run++
        else { if (run >= 5) p += run - 2; run = 1 }
      }
      const s = linha.map(v => (v ? '1' : '0')).join('')
      p += 40 * ((s.match(/(?=10111010000|00001011101)/g) ?? []).length)
    }
    for (let x = 0; x < n; x++) {
      if (m[y][x]) escuros++
      if (y < n - 1 && x < n - 1 && m[y][x] === m[y][x + 1] && m[y][x] === m[y + 1][x] && m[y][x] === m[y + 1][x + 1]) p += 3
    }
  }
  p += Math.floor(Math.abs(escuros * 20 - n * n * 10) / (n * n)) * 10
  return p
}

/** Caminho SVG dos módulos escuros (1 unidade = 1 módulo), com margem branca de 4 módulos. */
export function caminhoSvg(matriz: boolean[][], margem = 4) {
  let d = ''
  matriz.forEach((linha, y) => linha.forEach((escuro, x) => { if (escuro) d += `M${x + margem} ${y + margem}h1v1h-1z` }))
  return { d, tamanho: matriz.length + margem * 2 }
}
