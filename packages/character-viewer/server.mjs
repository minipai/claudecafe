#!/usr/bin/env node
// character-viewer — a dev server over `packages/characters`. Nothing is built
// and nothing is cached: the cast is read off disk on every request, so the page
// is always describing the folder as it actually stands, and a portrait that was
// just saved is one reload away.
import { createServer } from 'node:http'
import fs from 'node:fs/promises'
import { networkInterfaces } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { readCast } from './lib/cast.mjs'
import { readExpressions } from './lib/cues.mjs'
import { checkCast } from './lib/health.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const PUBLIC = path.join(HERE, 'public')
const CAST = path.resolve(HERE, '../characters')
const PORT = Number(process.env.PORT ?? 5051)

const MIME = {
  '.css': 'text/css; charset=utf-8',
  '.gif': 'image/gif',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.webp': 'image/webp',
}

createServer(async (request, response) => {
  const { pathname } = new URL(request.url ?? '/', 'http://character-viewer')
  try {
    if (pathname === '/api/cast') return json(response, manifest())
    if (pathname.startsWith('/asset/')) return await send(response, await contained(CAST, pathname.slice('/asset/'.length)))
    return await send(response, await contained(PUBLIC, pathname === '/' ? 'index.html' : pathname.slice(1)))
  } catch (error) {
    text(response, 400, error.message)
  }
}).listen(PORT, '0.0.0.0', () => {
  console.log('character-viewer')
  for (const address of reachableAddresses()) console.log(`  http://${address}:${PORT}/`)
  console.log(`  ${CAST}`)
})

function manifest() {
  const cast = readCast(CAST)
  const expressions = readExpressions(path.resolve(HERE, '../persona-panel'))
  return { ...cast, ...checkCast(cast, expressions) }
}

/** A request may only name a file inside the folder it started in. */
async function contained(root, request) {
  const target = path.resolve(root, request)
  if (!target.startsWith(root + path.sep) && target !== root) throw new Error(`Outside ${root}: ${request}`)
  return target
}

async function send(response, file) {
  let body
  try {
    body = await fs.readFile(file)
  } catch {
    return text(response, 404, `Not in the cast: ${file}`)
  }
  response.writeHead(200, { 'content-type': MIME[path.extname(file)] ?? 'application/octet-stream', 'cache-control': 'no-store' })
  response.end(body)
}

const json = (response, body) => {
  response.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
  response.end(JSON.stringify(body))
}

const text = (response, status, body) => {
  response.writeHead(status, { 'content-type': 'text/plain; charset=utf-8' })
  response.end(body)
}

function reachableAddresses() {
  return Object.values(networkInterfaces())
    .flat()
    .filter((entry) => entry?.family === 'IPv4' && !entry.internal)
    .map((entry) => entry.address)
}
