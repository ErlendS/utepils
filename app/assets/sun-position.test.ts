import assert from 'node:assert/strict'
import test from 'node:test'

import SunCalc from 'suncalc'

import { getSunPosition } from './sun-position.ts'

test('sun position matches SunCalc for Oslo east longitude', () => {
  let date = new Date('2026-05-24T10:00:00.000Z')
  let expected = SunCalc.getPosition(date, 59.9139, 10.7522)
  let actual = getSunPosition(date, 59.9139, 10.7522)

  assert.ok(Math.abs(actual.altitude - expected.altitude) < 1e-12)
  assert.ok(Math.abs(actual.azimuth - expected.azimuth) < 1e-12)
})
