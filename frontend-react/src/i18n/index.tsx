/**
 * Idiomas do Omni-EcoRescue (mesma lista e mesma lógica do PerTo Saúde).
 *
 * Como funciona: o app continua escrito em português. Este módulo observa a tela
 * e troca cada texto em português pela tradução do idioma escolhido. A chave de
 * cada tradução é o próprio texto em português, e textos com partes variáveis
 * usam {0}, {1}… (ex.: "Moradores de {0} e região").
 *
 * - Idioma escolhido fica salvo no aparelho (localStorage).
 * - Sem escolha salva, usa o idioma do navegador; se não houver tradução, português.
 * - Texto sem tradução continua em português (nada some da tela).
 * - Hebraico vira a página da direita para a esquerda.
 * - Para um trecho NÃO ser traduzido: class="notranslate" ou translate="no".
 */
import { useSyncExternalStore } from 'react'
import type { CSSProperties } from 'react'

export const LANGUAGES = [
  { code: 'pt', name: 'Português' },
  { code: 'es', name: 'Español' },
  { code: 'en', name: 'English' },
  { code: 'fr', name: 'Français' },
  { code: 'it', name: 'Italiano' },
  { code: 'nl', name: 'Nederlands' },
  { code: 'sv', name: 'Svenska' },
  { code: 'de', name: 'Deutsch' },
  { code: 'no', name: 'Norsk' },
  { code: 'ru', name: 'Русский' },
  { code: 'ja', name: '日本語' },
  { code: 'ko', name: '한국어' },
  { code: 'zh', name: '中文' },
  { code: 'he', name: 'עברית' },
] as const

export type LanguageCode = (typeof LANGUAGES)[number]['code']
type Dict = Record<string, string>

const STORAGE_KEY = 'omni-language'
const RTL_LANGS = new Set<LanguageCode>(['he'])
const ATTRS = ['title', 'placeholder', 'aria-label', 'alt'] as const
const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEXTAREA', 'CODE', 'PRE', 'svg'])

// Cada idioma é um arquivo separado, carregado só quando for escolhido.
const loaders: Record<Exclude<LanguageCode, 'pt'>, () => Promise<{ default: Dict }>> = {
  es: () => import('./locales/es'),
  en: () => import('./locales/en'),
  fr: () => import('./locales/fr'),
  it: () => import('./locales/it'),
  nl: () => import('./locales/nl'),
  sv: () => import('./locales/sv'),
  de: () => import('./locales/de'),
  no: () => import('./locales/no'),
  ru: () => import('./locales/ru'),
  ja: () => import('./locales/ja'),
  ko: () => import('./locales/ko'),
  zh: () => import('./locales/zh'),
  he: () => import('./locales/he'),
}

const isCode = (code: string | null | undefined): code is LanguageCode => LANGUAGES.some(l => l.code === code)

function initialLanguage(): LanguageCode {
  try { const saved = localStorage.getItem(STORAGE_KEY); if (isCode(saved)) return saved } catch { /* sem localStorage */ }
  try { const nav = (navigator.language || 'pt').slice(0, 2).toLowerCase(); if (isCode(nav)) return nav } catch { /* ignore */ }
  return 'pt'
}

// ── Estado do idioma ────────────────────────────────────────────────────────
let language: LanguageCode = 'pt'
let dict: Dict = {}
let templates: { re: RegExp; out: string; order: number[] }[] = []
const listeners = new Set<() => void>()

const norm = (s: string) => s.replace(/\s+/g, ' ').trim()
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

function compileTemplates(d: Dict) {
  return Object.keys(d)
    .filter(k => /\{\d+\}/.test(k))
    .sort((a, b) => b.replace(/\{\d+\}/g, '').length - a.replace(/\{\d+\}/g, '').length)
    .map(k => {
      const order: number[] = []
      const pattern = k.split(/(\{\d+\})/).map(part => {
        const m = /^\{(\d+)\}$/.exec(part)
        if (m) { order.push(Number(m[1])); return '(.+?)' }
        return escapeRe(part)
      }).join('')
      // a tradução usa {0}, {1}…; cada número aponta para o grupo capturado na ordem do texto original
      return { re: new RegExp(`^${pattern}$`, 's'), out: d[k], order }
    })
}

/** Traduz um texto em português para o idioma atual (ou devolve o próprio texto). */
export function translate(text: string): string {
  if (language === 'pt') return text
  const key = norm(text)
  if (!key) return text
  let result = dict[key]
  if (result === undefined) {
    for (const t of templates) {
      const m = t.re.exec(key)
      if (!m) continue
      let out = t.out
      // as partes variáveis também são traduzidas quando existem no dicionário (ex.: nome de placa, país)
      t.order.forEach((n, i) => { const part = m[i + 1]; out = out.split(`{${n}}`).join(dict[part] ?? part) })
      result = out
      break
    }
  }
  if (result === undefined) return text
  // mantém os espaços das pontas (o React junta pedaços de texto com eles)
  const lead = /^\s*/.exec(text)?.[0] ?? ''
  const trail = /\s*$/.exec(text)?.[0] ?? ''
  return lead + result + trail
}

/** Para textos montados em código (ex.: mensagens de alert()). */
export function t(text: string, params?: Record<string, string | number>) {
  let s = translate(text)
  if (params) Object.entries(params).forEach(([k, v]) => { s = s.split(`{${k}}`).join(String(v)) })
  return s
}

// ── Tradução da tela ───────────────────────────────────────────────────────
type Slot = { orig: string; applied: string }
const textSlots = new WeakMap<Text, Slot>()
const attrSlots = new WeakMap<Element, Record<string, Slot>>()

function skipped(el: Element | null): boolean {
  for (let e = el; e; e = e.parentElement) {
    if (SKIP_TAGS.has(e.tagName) || e.getAttribute('translate') === 'no' || e.classList.contains('notranslate') || (e as HTMLElement).isContentEditable) return true
  }
  return false
}

function applyText(node: Text) {
  const current = node.nodeValue ?? ''
  let slot = textSlots.get(node)
  if (slot && current === slot.applied) {
    // texto já traduzido; só refaz se o idioma mudou
    const again = translate(slot.orig)
    if (again !== current) { slot.applied = again; node.nodeValue = again }
    return
  }
  if (!/[A-Za-zÀ-ÿ]/.test(current)) { if (slot) textSlots.delete(node); return }
  if (skipped(node.parentElement)) return
  const out = translate(current)
  if (!slot) { slot = { orig: current, applied: out }; textSlots.set(node, slot) }
  else { slot.orig = current; slot.applied = out }
  if (out !== current) node.nodeValue = out
}

function applyAttrs(el: Element) {
  for (const name of ATTRS) {
    const current = el.getAttribute(name)
    if (current === null) continue
    let slots = attrSlots.get(el)
    const slot = slots?.[name]
    if (!(slot && current === slot.applied) && !/[A-Za-zÀ-ÿ]/.test(current)) continue
    const orig = slot && current === slot.applied ? slot.orig : current
    if (!slot && skipped(el)) continue
    const out = translate(orig)
    if (!slots) { slots = {}; attrSlots.set(el, slots) }
    slots[name] = { orig, applied: out }
    if (out !== current) el.setAttribute(name, out)
  }
}

function walk(root: Node) {
  if (root.nodeType === Node.TEXT_NODE) { applyText(root as Text); return }
  if (root.nodeType !== Node.ELEMENT_NODE && root.nodeType !== Node.DOCUMENT_FRAGMENT_NODE) return
  if (root.nodeType === Node.ELEMENT_NODE) {
    if (SKIP_TAGS.has((root as Element).tagName)) return
    applyAttrs(root as Element)
  }
  const tw = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT)
  for (let n = tw.nextNode(); n; n = tw.nextNode()) {
    if (n.nodeType === Node.TEXT_NODE) applyText(n as Text)
    else applyAttrs(n as Element)
  }
}

let observer: MutationObserver | null = null
function translateDocument() {
  if (typeof document === 'undefined') return
  document.documentElement.lang = language === 'pt' ? 'pt-BR' : language
  document.documentElement.dir = RTL_LANGS.has(language) ? 'rtl' : 'ltr'
  observer?.disconnect()
  walk(document.body)
  observe()
}

function observe() {
  if (!observer) {
    observer = new MutationObserver(records => {
      observer?.disconnect()
      for (const r of records) {
        if (r.type === 'characterData') applyText(r.target as Text)
        else if (r.type === 'attributes') applyAttrs(r.target as Element)
        else r.addedNodes.forEach(walk)
      }
      observe()
    })
  }
  observer.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: [...ATTRS] })
}

/** Troca o idioma do app inteiro. */
export async function setLanguage(code: LanguageCode) {
  if (!isCode(code)) return
  try { localStorage.setItem(STORAGE_KEY, code) } catch { /* ignore */ }
  if (code === 'pt') { dict = {}; templates = [] }
  else {
    try { const mod = await loaders[code](); dict = mod.default; templates = compileTemplates(dict) }
    catch { return }
  }
  language = code
  translateDocument()
  listeners.forEach(fn => fn())
}

export function getLanguage() { return language }

/** Chame uma vez no main.tsx, antes de desenhar o app. */
export function startI18n() {
  const first = initialLanguage()
  if (typeof document === 'undefined') return
  const begin = () => { observe(); if (first !== 'pt') void setLanguage(first); else translateDocument() }
  if (document.body) begin(); else document.addEventListener('DOMContentLoaded', begin, { once: true })
}

export function useLanguage() {
  const current = useSyncExternalStore(fn => { listeners.add(fn); return () => listeners.delete(fn) }, () => language, () => language)
  return { language: current, setLanguage, languages: LANGUAGES, dir: RTL_LANGS.has(current) ? 'rtl' : 'ltr' }
}

// ── Seletor pronto ─────────────────────────────────────────────────────────
export function LanguageSelector({ className, style }: { className?: string; style?: CSSProperties }) {
  const { language: current, languages } = useLanguage()
  return (
    <select
      value={current}
      onChange={e => void setLanguage(e.target.value as LanguageCode)}
      className={`language-selector notranslate ${className ?? ''}`}
      style={style}
      aria-label="Idioma / Language"
      translate="no"
    >
      {languages.map(l => <option key={l.code} value={l.code}>{l.name}</option>)}
    </select>
  )
}
