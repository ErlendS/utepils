import { existsSync, readFileSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { serve } from 'remix/node-serve'

import { router } from './app/router.ts'

loadDotEnv()

const port = process.env.PORT ? Number.parseInt(process.env.PORT, 10) : 3000

const server = serve(
  async (request) => {
    try {
      let publicResponse = await servePublicAsset(request)
      if (publicResponse) return publicResponse

      let response = await router.fetch(getRoutableRequest(request))
      if (request.method === 'HEAD') {
        return new Response(null, {
          headers: response.headers,
          status: response.status,
          statusText: response.statusText,
        })
      }
      return response
    } catch (error) {
      console.error(error)
      return new Response('Internal Server Error', { status: 500 })
    }
  },
  {
    port,
  },
)

await server.ready
console.log(`Server listening on http://localhost:${server.port}`)

let shuttingDown = false

function shutdown() {
  if (shuttingDown) {
    return
  }

  shuttingDown = true
  server.close()
  process.exit(0)
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)

function getRoutableRequest(request: Request) {
  if (request.method !== 'HEAD') return request
  return new Request(request, { method: 'GET' })
}

const publicAssets = new Map([
  ['/android-chrome-192x192.png', 'image/png'],
  ['/android-chrome-512x512.png', 'image/png'],
  ['/apple-touch-icon.png', 'image/png'],
  ['/favicon-16x16.png', 'image/png'],
  ['/favicon-32x32.png', 'image/png'],
  ['/favicon.ico', 'image/x-icon'],
  ['/site.webmanifest', 'application/manifest+json; charset=utf-8'],
])

async function servePublicAsset(request: Request) {
  if (request.method !== 'GET' && request.method !== 'HEAD') return null

  let { pathname } = new URL(request.url)
  let contentType = publicAssets.get(pathname)
  if (!contentType) return null

  try {
    let body = await readFile(path.join(process.cwd(), 'public', pathname))

    return new Response(request.method === 'HEAD' ? null : body, {
      headers: {
        'Cache-Control': 'public, max-age=3600',
        'Content-Length': String(body.byteLength),
        'Content-Type': contentType,
      },
    })
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
      return null
    }
    throw error
  }
}

function loadDotEnv() {
  if (!existsSync('.env')) return

  for (let line of readFileSync('.env', 'utf8').split(/\r?\n/)) {
    let trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    let match = /^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/.exec(trimmed)
    if (!match) continue
    let [, key, rawValue] = match
    if (process.env[key] !== undefined) continue
    process.env[key] = rawValue.replace(/^["']|["']$/g, '')
  }
}
