import { existsSync, readFileSync } from 'node:fs'
import { serve } from 'remix/node-serve'

import { router } from './app/router.ts'

loadDotEnv()

const port = process.env.PORT ? Number.parseInt(process.env.PORT, 10) : 3000

const server = serve(
  async (request) => {
    try {
      return await router.fetch(request)
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
