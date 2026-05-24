import assert from 'node:assert/strict'
import test from 'node:test'

import { poiProfile } from './api.ts'

const poiProfileAction = poiProfile as {
  handler(context: { request: Request }): Promise<Response> | Response
}

test('poi profile requires explicit lat and lng query parameters', async () => {
  let response = await callPoiProfile('http://localhost/api/poi-profile')

  assert.equal(response.status, 400)
  assert.deepEqual(await response.json(), {
    error: 'lat and lng query parameters are required.',
  })
})

test('poi profile rejects empty lat and lng query parameters', async () => {
  let response = await callPoiProfile('http://localhost/api/poi-profile?lat=&lng=')

  assert.equal(response.status, 400)
  assert.deepEqual(await response.json(), {
    error: 'lat and lng query parameters are required.',
  })
})

function callPoiProfile(url: string) {
  return poiProfileAction.handler({
    request: new Request(url, {
      headers: {
        'Fly-Client-IP': `api-test-${globalThis.crypto.randomUUID()}`,
      },
    }),
  })
}
