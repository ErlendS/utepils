import assert from 'node:assert/strict'
import { afterEach, test } from 'node:test'

import { getDataLayers } from './solar.ts'

const originalFetch = globalThis.fetch

afterEach(() => {
  globalThis.fetch = originalFetch
})

test('data layer request retries coverage failures with medium quality', async () => {
  let requestedQualities: string[] = []

  globalThis.fetch = (async (input) => {
    let url = getFetchUrl(input)
    requestedQualities.push(url.searchParams.get('requiredQuality') ?? '')

    if (requestedQualities.length === 1) {
      return jsonResponse(
        {
          error: {
            status: 'NOT_FOUND',
            message: 'No imagery found for the requested quality.',
          },
        },
        404,
      )
    }

    return jsonResponse({
      dsmUrl: 'https://example.com/dsm.tif',
      imageryQuality: 'MEDIUM',
    })
  }) as typeof fetch

  let layers = await getDataLayers(
    {
      lat: 59.9139,
      lng: 10.7522,
      pixelSizeMeters: 0.5,
      radiusMeters: 300,
    },
    'solar-key',
  )

  assert.equal(layers.imageryQuality, 'MEDIUM')
  assert.deepEqual(requestedQualities, ['HIGH', 'MEDIUM'])
})

test('data layer request does not retry non-coverage failures', async () => {
  let requestedQualities: string[] = []

  globalThis.fetch = (async (input) => {
    let url = getFetchUrl(input)
    requestedQualities.push(url.searchParams.get('requiredQuality') ?? '')

    return jsonResponse(
      {
        error: {
          status: 'RESOURCE_EXHAUSTED',
          message: 'Quota exceeded.',
        },
      },
      429,
    )
  }) as typeof fetch

  await assert.rejects(
    getDataLayers(
      {
        lat: 59.9139,
        lng: 10.7522,
        pixelSizeMeters: 0.5,
        radiusMeters: 300,
      },
      'solar-key',
    ),
    /Quota exceeded/,
  )
  assert.deepEqual(requestedQualities, ['HIGH'])
})

function getFetchUrl(input: RequestInfo | URL) {
  if (input instanceof Request) return new URL(input.url)
  return new URL(String(input))
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    headers: { 'Content-Type': 'application/json' },
    status,
  })
}
