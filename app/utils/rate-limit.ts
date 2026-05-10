import { LruMap } from './lru-map.ts'

interface RateWindow {
  count: number
  resetAt: number
}

const WINDOW_MS = 60_000
const MAX_REQUESTS = 20
const ipWindows = new LruMap<string, RateWindow>(10_000)

export function checkRateLimit(ip: string): { allowed: boolean; retryAfterSeconds: number } {
  let now = Date.now()
  let window = ipWindows.get(ip)

  if (!window || now >= window.resetAt) {
    ipWindows.set(ip, { count: 1, resetAt: now + WINDOW_MS })
    return { allowed: true, retryAfterSeconds: 0 }
  }

  if (window.count >= MAX_REQUESTS) {
    return { allowed: false, retryAfterSeconds: Math.ceil((window.resetAt - now) / 1000) }
  }

  window.count++
  return { allowed: true, retryAfterSeconds: 0 }
}

export function getClientIp(request: Request): string {
  return (
    request.headers.get('Fly-Client-IP') ??
    request.headers.get('X-Forwarded-For')?.split(',')[0]?.trim() ??
    'unknown'
  )
}
