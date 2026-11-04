import '@/lib/abortPolyfill'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { App } from '@/app/App'
import '@/styles/globals.css'
import { startI18n } from '@/i18n'

startI18n()

createRoot(document.getElementById('root')!).render(
  <StrictMode><BrowserRouter><App /></BrowserRouter></StrictMode>,
)

// Guarda o app no celular para abrir sem internet (só no site publicado, não no modo de desenvolvimento).
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => { navigator.serviceWorker.register('/sw.js').catch(() => { /* sem modo offline neste navegador */ }) })
}
