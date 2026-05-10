import * as geokeysToProj4 from 'geotiff-geokeys-to-proj4'
import { fromArrayBuffer } from 'geotiff'
import proj4 from 'proj4'

import type { Bounds, DsmRaster } from './horizon.ts'

interface DataLayersResponse {
  dsmUrl?: string
  imageryDate?: unknown
  imageryQuality?: string
}

interface DsmRequest {
  lat: number
  lng: number
  pixelSizeMeters: number
  radiusMeters: number
}

const dsmCache = new Map<string, Promise<DsmRaster>>()

export function getDsmForPoint(request: DsmRequest) {
  let key = [
    request.lat.toFixed(3),
    request.lng.toFixed(3),
    request.radiusMeters,
    request.pixelSizeMeters,
  ].join(':')

  let cached = dsmCache.get(key)
  if (!cached) {
    cached = fetchDsmForPoint(request)
    dsmCache.set(key, cached)
  }
  return cached
}

async function fetchDsmForPoint(request: DsmRequest): Promise<DsmRaster> {
  let apiKey = getGoogleSolarApiKey()
  if (!apiKey) {
    throw new Error('Missing GOOGLE_SOLAR_API_KEY.')
  }

  let layers = await getDataLayers(request, apiKey)
  if (!layers.dsmUrl) {
    throw new Error('Solar API did not return a DSM URL for this point.')
  }

  return downloadDsm(layers, apiKey)
}

async function getDataLayers(request: DsmRequest, apiKey: string): Promise<DataLayersResponse> {
  let params = new URLSearchParams({
    'location.latitude': request.lat.toFixed(7),
    'location.longitude': request.lng.toFixed(7),
    radiusMeters: String(request.radiusMeters),
    view: 'DSM_LAYER',
    requiredQuality: 'HIGH',
    exactQualityRequired: 'true',
    pixelSizeMeters: String(request.pixelSizeMeters),
    key: apiKey,
  })

  let response = await fetch(`https://solar.googleapis.com/v1/dataLayers:get?${params}`, {
    headers: getGoogleRequestHeaders(),
  })
  let body = await response.json().catch(() => undefined)
  if (!response.ok) {
    throw new Error(formatSolarError(body, `Solar dataLayers:get failed with ${response.status}.`))
  }
  return body as DataLayersResponse
}

async function downloadDsm(layers: DataLayersResponse, apiKey: string): Promise<DsmRaster> {
  let response = await fetch(appendApiKey(layers.dsmUrl!, apiKey), {
    headers: getGoogleRequestHeaders(),
  })
  if (!response.ok) {
    let body = await response.json().catch(() => undefined)
    throw new Error(formatSolarError(body, `Solar GeoTIFF download failed with ${response.status}.`))
  }

  let arrayBuffer = await response.arrayBuffer()
  let tiff = await fromArrayBuffer(arrayBuffer)
  let image = await tiff.getImage()
  let rasterResult = (await image.readRasters({ interleave: true })) as unknown
  let data = Float32Array.from(rasterResult as ArrayLike<number>)
  let width = image.getWidth()
  let height = image.getHeight()
  let bounds = getLatLngBounds(image)
  let pixelSizes = getPixelSizesMeters(bounds, width, height)

  return {
    bounds,
    data,
    height,
    imageryDate: layers.imageryDate,
    imageryQuality: layers.imageryQuality,
    pixelSizeXMeters: pixelSizes.x,
    pixelSizeYMeters: pixelSizes.y,
    width,
  }
}

function getLatLngBounds(image: {
  getBoundingBox(): number[]
  getGeoKeys(): unknown
}): Bounds {
  let geoKeys = image.getGeoKeys()
  if (!geoKeys) {
    throw new Error('Solar DSM GeoTIFF is missing projection metadata.')
  }

  let projObj = geokeysToProj4.toProj4(geoKeys as never)
  let projection = proj4(projObj.proj4, 'WGS84')
  let box = image.getBoundingBox()
  let conversion = projObj.coordinatesConversionParameters ?? { x: 1, y: 1 }

  let sw = projection.forward({
    x: box[0] * conversion.x,
    y: box[1] * conversion.y,
  }) as { x: number; y: number }
  let ne = projection.forward({
    x: box[2] * conversion.x,
    y: box[3] * conversion.y,
  }) as { x: number; y: number }

  return {
    east: ne.x,
    north: ne.y,
    south: sw.y,
    west: sw.x,
  }
}

function getPixelSizesMeters(bounds: Bounds, width: number, height: number) {
  let centerLat = (bounds.north + bounds.south) / 2
  let horizontalMeters = distanceMeters(centerLat, bounds.west, centerLat, bounds.east)
  let verticalMeters = distanceMeters(bounds.south, bounds.west, bounds.north, bounds.west)

  return {
    x: horizontalMeters / Math.max(1, width - 1),
    y: verticalMeters / Math.max(1, height - 1),
  }
}

function distanceMeters(lat1: number, lng1: number, lat2: number, lng2: number) {
  let radius = 6371008.8
  let phi1 = toRadians(lat1)
  let phi2 = toRadians(lat2)
  let deltaPhi = toRadians(lat2 - lat1)
  let deltaLambda = toRadians(lng2 - lng1)
  let a =
    Math.sin(deltaPhi / 2) ** 2 +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) ** 2
  return radius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function appendApiKey(url: string, apiKey: string) {
  return `${url}${url.includes('?') ? '&' : '?'}key=${encodeURIComponent(apiKey)}`
}

function getGoogleSolarApiKey() {
  return process.env.GOOGLE_SOLAR_API_KEY
}

function getGoogleRequestHeaders() {
  let referer = process.env.GOOGLE_MAPS_PLATFORM_REFERER ?? 'http://localhost:3000/'
  return { Referer: referer }
}

function formatSolarError(body: unknown, fallback: string) {
  if (body && typeof body === 'object' && 'error' in body) {
    let error = (body as { error?: { message?: string; status?: string } }).error
    if (error?.message) return `${error.status ?? 'Solar API error'}: ${error.message}`
  }
  return fallback
}

function toRadians(degrees: number) {
  return (degrees * Math.PI) / 180
}
