import type { BuildAction } from 'remix/fetch-router'

import type { routes } from '../routes.ts'
import { computeHorizonProfile } from '../services/horizon.ts'
import { getDsmForPoint } from '../services/solar.ts'
import { LruMap } from '../utils/lru-map.ts'
import { checkRateLimit, getClientIp } from '../utils/rate-limit.ts'

const OSLO = { lat: 59.9139, lng: 10.7522 }
const SOLAR_RADIUS_METERS = 300
const SOLAR_PIXEL_SIZE_METERS = 0.5

const profileCache = new LruMap<string, Promise<Response>>(200)

export const apiConfig: BuildAction<'GET', typeof routes.apiConfig> = {
  handler() {
    let googleMapsApiKey = getGoogleMapsApiKey()
    if (!googleMapsApiKey) {
      return json(
        {
          error:
            'Missing GOOGLE_MAPS_PLATFORM_API_KEY. Add it to your environment before starting the server.',
        },
        { status: 500 },
      )
    }

    return json({
      googleMapsApiKey,
      city: OSLO,
      solarRadiusMeters: SOLAR_RADIUS_METERS,
      solarPixelSizeMeters: SOLAR_PIXEL_SIZE_METERS,
    })
  },
}

export const poiProfile: BuildAction<'GET', typeof routes.apiPoiProfile> = {
  handler({ request }) {
    let { allowed, retryAfterSeconds } = checkRateLimit(getClientIp(request))
    if (!allowed) {
      return json({ error: 'Too many requests.' }, { status: 429, headers: { 'Retry-After': String(retryAfterSeconds) } })
    }

    let url = new URL(request.url)
    let lat = Number(url.searchParams.get('lat'))
    let lng = Number(url.searchParams.get('lng'))

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return json({ error: 'lat and lng query parameters are required.' }, { status: 400 })
    }

    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return json({ error: 'lat/lng is outside valid coordinate bounds.' }, { status: 400 })
    }

    let key = `${lat.toFixed(5)},${lng.toFixed(5)}`
    let cached = profileCache.get(key)
    if (!cached) {
      cached = buildProfileResponse(lat, lng)
      profileCache.set(key, cached)
    }
    return cached
  },
}

async function buildProfileResponse(lat: number, lng: number) {
  try {
    let dsm = await getDsmForPoint({
      lat,
      lng,
      radiusMeters: SOLAR_RADIUS_METERS,
      pixelSizeMeters: SOLAR_PIXEL_SIZE_METERS,
    })
    let profile = computeHorizonProfile(dsm, lat, lng, SOLAR_RADIUS_METERS)

    return json(
      {
        lat,
        lng,
        horizon: profile.horizon,
        observerElevationMeters: profile.observerElevationMeters,
        dsm: {
          bounds: dsm.bounds,
          width: dsm.width,
          height: dsm.height,
          pixelSizeXMeters: dsm.pixelSizeXMeters,
          pixelSizeYMeters: dsm.pixelSizeYMeters,
          imageryQuality: dsm.imageryQuality,
          imageryDate: dsm.imageryDate,
        },
      },
      {
        headers: {
          'Cache-Control': 'private, max-age=86400',
        },
      },
    )
  } catch (error) {
    profileCache.delete(`${lat.toFixed(5)},${lng.toFixed(5)}`)
    let message = error instanceof Error ? error.message : 'Unable to compute sun profile.'
    return json({ error: message }, { status: 502 })
  }
}

function getGoogleMapsApiKey() {
  return process.env.GOOGLE_MAPS_PLATFORM_API_KEY
}

function json(body: unknown, init?: ResponseInit) {
  let headers = new Headers(init?.headers)
  headers.set('Content-Type', 'application/json; charset=utf-8')
  return new Response(JSON.stringify(body), { ...init, headers })
}
