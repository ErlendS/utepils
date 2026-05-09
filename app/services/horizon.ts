export interface Bounds {
  north: number
  south: number
  east: number
  west: number
}

export interface DsmRaster {
  bounds: Bounds
  data: Float32Array
  height: number
  imageryDate?: unknown
  imageryQuality?: string
  pixelSizeXMeters: number
  pixelSizeYMeters: number
  width: number
}

export interface HorizonProfile {
  horizon: number[]
  observerElevationMeters: number
}

const INVALID_DSM_VALUE = -9999
const OBSERVER_HEIGHT_METERS = 1.5

export function computeHorizonProfile(
  dsm: DsmRaster,
  originLat: number,
  originLng: number,
  radiusMeters: number,
): HorizonProfile {
  let origin = latLngToPixel(dsm, originLat, originLng)
  let groundElevation = estimateGroundElevation(dsm, origin.x, origin.y)
  let observerElevationMeters = groundElevation + OBSERVER_HEIGHT_METERS
  let stepMeters = Math.max(0.75, dsm.pixelSizeXMeters, dsm.pixelSizeYMeters)
  let horizon = new Array<number>(360)

  for (let azimuthDeg = 0; azimuthDeg < 360; azimuthDeg += 1) {
    let azimuth = (azimuthDeg * Math.PI) / 180
    let stepX = (Math.sin(azimuth) * stepMeters) / dsm.pixelSizeXMeters
    let stepY = (-Math.cos(azimuth) * stepMeters) / dsm.pixelSizeYMeters
    let maxAngle = -Math.PI / 2

    for (let distance = stepMeters; distance <= radiusMeters; distance += stepMeters) {
      let multiplier = distance / stepMeters
      let x = origin.x + stepX * multiplier
      let y = origin.y + stepY * multiplier
      if (!isInsideRaster(dsm, x, y)) break

      let obstructionElevation = sampleNearest(dsm, x, y)
      if (!Number.isFinite(obstructionElevation) || obstructionElevation <= INVALID_DSM_VALUE) {
        continue
      }

      let angle = Math.atan2(obstructionElevation - observerElevationMeters, distance)
      if (angle > maxAngle) maxAngle = angle
    }

    horizon[azimuthDeg] = maxAngle
  }

  return { horizon, observerElevationMeters }
}

function estimateGroundElevation(dsm: DsmRaster, originX: number, originY: number) {
  let radiusPixels = Math.max(2, Math.ceil(8 / Math.max(dsm.pixelSizeXMeters, dsm.pixelSizeYMeters)))
  let values: number[] = []

  for (let dy = -radiusPixels; dy <= radiusPixels; dy += 1) {
    for (let dx = -radiusPixels; dx <= radiusPixels; dx += 1) {
      if (dx * dx + dy * dy > radiusPixels * radiusPixels) continue
      let value = sampleNearest(dsm, originX + dx, originY + dy)
      if (Number.isFinite(value) && value > INVALID_DSM_VALUE) values.push(value)
    }
  }

  if (values.length === 0) {
    throw new Error('The selected point is outside valid DSM coverage.')
  }

  values.sort((a, b) => a - b)
  return values[Math.floor(values.length * 0.1)] ?? values[0]
}

function latLngToPixel(dsm: DsmRaster, lat: number, lng: number) {
  let x = ((lng - dsm.bounds.west) / (dsm.bounds.east - dsm.bounds.west)) * (dsm.width - 1)
  let y = ((dsm.bounds.north - lat) / (dsm.bounds.north - dsm.bounds.south)) * (dsm.height - 1)
  return { x, y }
}

function sampleNearest(dsm: DsmRaster, x: number, y: number) {
  let col = Math.round(x)
  let row = Math.round(y)
  if (row < 0 || row >= dsm.height || col < 0 || col >= dsm.width) return Number.NaN
  return dsm.data[row * dsm.width + col]
}

function isInsideRaster(dsm: DsmRaster, x: number, y: number) {
  return x >= 0 && y >= 0 && x < dsm.width && y < dsm.height
}
