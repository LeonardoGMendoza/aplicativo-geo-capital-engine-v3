// Local QA server: serves the production build with an explicitly requested map fault.
// No NASA responses or project assets are invented or overwritten.
import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { resolve, extname, relative } from 'node:path'
const root = resolve(import.meta.dirname, '../dist')
const mime = { '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.html': 'text/html' }
let fault = null
createServer(async (request, response) => {
  const url = new URL(request.url, 'http://127.0.0.1:5173')
  const file = resolve(root, '.' + url.pathname)
  if (relative(root, file).startsWith('..')) { response.writeHead(403); response.end(); return }
  let body, actual = file
  try { body = await readFile(actual) } catch { actual = resolve(root, 'index.html'); body = await readFile(actual) }
  if (extname(actual) === '.html') fault = url.searchParams.get('mapFailure')
  if (/NasaGeographicMap-.*\.js$/.test(file) && fault === 'load') {
    response.writeHead(503, { 'Content-Type': 'text/javascript', 'Cache-Control': 'no-store' })
    response.end('// Intentional local QA: map chunk unavailable'); return
  }
  if (/NasaGeographicMap-.*\.js$/.test(file) && fault === 'render') body = 'export default function MapQaFailure(){ throw new Error("Intentional local QA: map render failure") }'
  response.writeHead(200, { 'Content-Type': mime[extname(actual)] ?? 'application/octet-stream', 'Cache-Control': 'no-store', ...(fault === 'tiles' ? { 'Content-Security-Policy': "img-src 'self' data: blob:" } : {}) })
  response.end(body)
}).listen(5173, '127.0.0.1', () => console.log('P1 local QA: http://127.0.0.1:5173/mapa?mapFailure=load (load|render|tiles)'))
