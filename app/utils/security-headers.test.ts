import assert from 'node:assert/strict'
import test from 'node:test'

import { CONTENT_SECURITY_POLICY, setSecurityHeaders } from './security-headers.ts'

test('content security policy allows the Google Maps browser API', () => {
  let policy = parsePolicy(CONTENT_SECURITY_POLICY)

  assert.deepEqual(policy.get('script-src'), [
    "'self'",
    "'unsafe-eval'",
    'https://maps.googleapis.com',
    'https://maps.gstatic.com',
  ])
  assert.deepEqual(policy.get('connect-src'), [
    "'self'",
    'https://maps.googleapis.com',
    'https://mapsresources-pa.googleapis.com',
    'data:',
  ])
  assert.deepEqual(policy.get('frame-src'), ['https://google.com', 'https://*.google.com'])
  assert.deepEqual(policy.get('font-src'), ["'self'", 'https://fonts.gstatic.com'])
  assert.ok(policy.get('img-src')?.includes('https://*.ggpht.com'))
  assert.ok(policy.get('img-src')?.includes('https://*.googleusercontent.com'))
  assert.ok(policy.get('style-src')?.includes('https://fonts.googleapis.com'))
})

test('content security policy does not reuse image-only hosts for scripts or connections', () => {
  let policy = parsePolicy(CONTENT_SECURITY_POLICY)

  assert.equal(policy.get('script-src')?.includes('https://*.ggpht.com'), false)
  assert.equal(policy.get('script-src')?.includes('https://*.googleusercontent.com'), false)
  assert.equal(policy.get('connect-src')?.includes('https://*.ggpht.com'), false)
  assert.equal(policy.get('connect-src')?.includes('https://*.googleusercontent.com'), false)
  assert.doesNotMatch(CONTENT_SECURITY_POLICY, /blob:/)
  assert.equal(policy.get('script-src')?.some((source) => source.includes('fonts.google')), false)
  assert.equal(policy.get('connect-src')?.some((source) => source.includes('fonts.google')), false)
})

test('setSecurityHeaders applies baseline browser security headers', () => {
  let headers = new Headers()

  setSecurityHeaders(headers)

  assert.equal(headers.get('Content-Security-Policy'), CONTENT_SECURITY_POLICY)
  assert.equal(headers.get('Referrer-Policy'), 'strict-origin-when-cross-origin')
  assert.equal(headers.get('X-Content-Type-Options'), 'nosniff')
})

function parsePolicy(policy: string) {
  let directives = new Map<string, string[]>()

  for (let directive of policy.split('; ')) {
    let [name, ...sources] = directive.split(' ')
    directives.set(name, sources)
  }

  return directives
}
