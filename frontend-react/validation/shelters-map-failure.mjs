// Local validation only: deny remote images to reproduce unavailable OSM tiles.
import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { resolve, extname } from 'node:path'
const root = resolve(import.meta.dirname, '../dist')
const mime = { '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.html': 'text/html' }
createServer(async (request, response) => {
  const pathname = new URL(request.url, 'http://localhost').pathname
  const file = resolve(root, '.' + pathname)
  if (!file.startsWith(root + '/') && !file.startsWith(root + '\\') && file !== root) { response.writeHead(403); response.end(); return }
  let body, actual = file
  try { body = await readFile(actual) } catch { actual = resolve(root, 'index.html'); body = await readFile(actual) }
  response.writeHead(200, { 'Content-Type': mime[extname(actual)] ?? 'application/octet-stream', 'Content-Security-Policy': "img-src 'self' data: blob:" })
  response.end(body)
}).listen(5174, '127.0.0.1', () => process.stdout.write('Shelters map failure validation: http://127.0.0.1:5174/abrigos\n'))
