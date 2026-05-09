import assert from 'node:assert/strict'
import test from 'node:test'

import { computeHorizonProfile, type DsmRaster } from './horizon.ts'

test('horizon profile spikes toward a tall northern obstruction', () => {
  let width = 101
  let height = 101
  let data = new Float32Array(width * height)

  for (let row = 20; row <= 30; row += 1) {
    for (let col = 48; col <= 52; col += 1) {
      data[row * width + col] = 20
    }
  }

  let dsm: DsmRaster = {
    bounds: {
      north: 0.00045,
      south: -0.00045,
      east: 0.00045,
      west: -0.00045,
    },
    data,
    height,
    pixelSizeXMeters: 1,
    pixelSizeYMeters: 1,
    width,
  }

  let profile = computeHorizonProfile(dsm, 0, 0, 50)

  assert.ok(profile.horizon[0] > 0.4)
  assert.ok(profile.horizon[90] < 0)
  assert.ok(profile.horizon[180] < 0)
})
