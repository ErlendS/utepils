declare global {
  interface Window {
    __initSunMap?: () => void
    google?: typeof google
  }
}

export {}

type HorizonResponse = {
  dsm?: {
    height: number
    imageryQuality?: string
    pixelSizeXMeters: number
    pixelSizeYMeters: number
    width: number
  }
  error?: string
  horizon: number[]
  lat: number
  lng: number
  observerElevationMeters: number
}

type ConfigResponse = {
  city: { lat: number; lng: number }
  googleMapsApiKey: string
  solarPixelSizeMeters: number
  solarRadiusMeters: number
}

type MarkerMode = 'error' | 'loading' | 'shade' | 'sun'

type SunMarkerOverlay = google.maps.OverlayView & {
  setDayFill(fill?: string): void
  setMode(mode: MarkerMode): void
  setPosition(point: google.maps.LatLngLiteral): void
  setSunAngle(azimuthDeg?: number): void
}

type SunWindow = { end: number; start: number }

type SunAngleSample = { azimuthDeg: number; minute: number }

type PlacesLibraryWithAutocompleteElement = google.maps.PlacesLibrary & {
  PlaceAutocompleteElement: typeof google.maps.places.PlaceAutocompleteElement
}

class HttpError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message)
    this.name = 'HttpError'
  }
}

let map: google.maps.Map
let marker: SunMarkerOverlay | undefined
let selectedSunAngleSamples: SunAngleSample[] = []
let selectedProfile: HorizonResponse | undefined
let selectedPoint: google.maps.LatLngLiteral | undefined
let selectPointController: AbortController | undefined
let suppressMapClickUntil = 0
let sunAngleDragAzimuth: number | undefined
let sunAngleDragMinute: number | undefined

const els = {
  dot: document.querySelector<HTMLElement>('#status-dot')!,
  dsm: document.querySelector<HTMLElement>('#dsm-readout')!,
  label: document.querySelector<HTMLElement>('#status-label')!,
  detail: document.querySelector<HTMLElement>('#status-detail')!,
  map: document.querySelector<HTMLElement>('#map')!,
  placeSearchMessage: document.querySelector<HTMLElement>('#place-search-message')!,
  placeSearch: document.querySelector<HTMLElement>('#place-search')!,
  point: document.querySelector<HTMLElement>('#point-readout')!,
  slider: document.querySelector<HTMLInputElement>('#time-slider')!,
  time: document.querySelector<HTMLElement>('#time-output')!,
  toast: document.querySelector<HTMLElement>('#map-toast')!,
  useLocation: document.querySelector<HTMLButtonElement>('#use-location-button')!,
  windows: document.querySelector<HTMLElement>('#sun-windows')!,
}

let bootstrapped = false
let bootstrapping = false

void tryBootstrap()

document.addEventListener('visibilitychange', () => {
  if (!document.hidden && !bootstrapped) {
    hideToast()
    void tryBootstrap()
  }
})

async function tryBootstrap() {
  if (bootstrapped || bootstrapping) return
  bootstrapping = true
  try {
    await bootstrap()
    bootstrapped = true
  } catch (error) {
    bootstrapping = false
    showErrorToast(error instanceof Error ? error.message : 'Unable to start the app.')
  }
}

async function bootstrap() {
  setSliderToNow()
  els.slider.addEventListener('input', () => updateForCurrentTime())

  let config = await fetchWithRetry<ConfigResponse>('/api/config', 3, 1500)
  await loadGoogleMaps(config.googleMapsApiKey)

  map = new google.maps.Map(els.map, {
    center: config.city,
    clickableIcons: false,
    fullscreenControl: false,
    mapTypeControl: true,
    mapTypeId: google.maps.MapTypeId.TERRAIN,
    streetViewControl: false,
    zoom: 15,
  })

  map.addListener('click', (event: google.maps.MapMouseEvent) => {
    if (Date.now() < suppressMapClickUntil) return
    if (!event.latLng) return
    void selectPoint(event.latLng.toJSON())
  })
  els.useLocation.addEventListener('click', () => {
    void useCurrentLocation()
  })

  void setupPlaceSearch(config.city).catch((error) => {
    setPlaceSearchMessage(error instanceof Error ? error.message : 'Address search is unavailable.')
  })
  updateForCurrentTime()
}

async function setupPlaceSearch(origin: google.maps.LatLngLiteral) {
  let { PlaceAutocompleteElement } = (await google.maps.importLibrary('places')) as PlacesLibraryWithAutocompleteElement
  let placeAutocomplete = new PlaceAutocompleteElement({
    locationBias: map.getBounds() ?? origin,
    origin,
    requestedLanguage: navigator.language || document.documentElement.lang || null,
  })

  placeAutocomplete.placeholder = 'Search address or place'
  placeAutocomplete.setAttribute('aria-label', 'Search address or place')
  placeAutocomplete.addEventListener('gmp-error', () => {
    setPlaceSearchMessage('Address search is unavailable.')
  })
  placeAutocomplete.addEventListener('gmp-select', async (event) => {
    let place = event.placePrediction.toPlace()
    setStatus('Finding address', 'Loading the selected place.', 'loading')
    setPlaceSearchMessage()
    hideToast()

    try {
      await place.fetchFields({
        fields: ['displayName', 'formattedAddress', 'location'],
      })
      if (!place.location) throw new Error('No map location found for that address.')

      let point = place.location.toJSON()
      if (place.viewport) {
        map.fitBounds(place.viewport)
      } else {
        map.panTo(point)
        map.setZoom(Math.max(map.getZoom() ?? 0, 17))
      }
      await selectPoint(point)
    } catch (error) {
      let message = error instanceof Error ? error.message : 'Unable to load that address.'
      setStatus('Address failed', message, 'error')
      setPlaceSearchMessage(message)
    }
  })

  map.addListener('idle', () => {
    placeAutocomplete.locationBias = map.getBounds() ?? origin
  })

  els.placeSearch.replaceChildren(placeAutocomplete)
}

function setPlaceSearchMessage(message = '') {
  els.placeSearchMessage.textContent = message
}

async function useCurrentLocation() {
  if (!navigator.geolocation) {
    let message = 'Location access is not available in this browser.'
    setStatus('Location unavailable', message, 'error')
    showErrorToast(message)
    return
  }

  let previousLabel = els.useLocation.textContent ?? 'Use my location'
  els.useLocation.disabled = true
  els.useLocation.textContent = 'Finding location'
  setStatus('Finding location', 'Waiting for permission from your browser.', 'loading')
  hideToast()

  try {
    let position = await getCurrentPosition()
    let point = {
      lat: position.coords.latitude,
      lng: position.coords.longitude,
    }

    map.panTo(point)
    map.setZoom(Math.max(map.getZoom() ?? 0, 16))
    await selectPoint(point)
  } catch (error) {
    let message = geolocationErrorMessage(error)
    setStatus('Location failed', message, 'error')
    showErrorToast(message)
  } finally {
    els.useLocation.disabled = false
    els.useLocation.textContent = previousLabel
  }
}

function getCurrentPosition() {
  return new Promise<GeolocationPosition>((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      maximumAge: 60_000,
      timeout: 10_000,
    })
  })
}

function geolocationErrorMessage(error: unknown) {
  if (isGeolocationError(error)) {
    if (error.code === 1) return 'Location permission was denied.'
    if (error.code === 2) return 'Your location could not be determined.'
    if (error.code === 3) return 'Location lookup timed out.'
  }

  return 'Unable to get your location.'
}

function isGeolocationError(error: unknown): error is GeolocationPositionError {
  return Boolean(error && typeof error === 'object' && 'code' in error && typeof error.code === 'number')
}

async function selectPoint(point: google.maps.LatLngLiteral) {
  selectPointController?.abort()
  selectPointController = new AbortController()
  const signal = selectPointController.signal

  selectedPoint = point
  selectedProfile = undefined
  selectedSunAngleSamples = []
  setMarker(point, 'loading')
  marker?.setDayFill()
  marker?.setSunAngle()
  setLoading(point)

  try {
    let profile = await fetchJson<HorizonResponse>(
      `/api/poi-profile?lat=${encodeURIComponent(point.lat)}&lng=${encodeURIComponent(point.lng)}`,
      signal,
    )
    selectedProfile = profile
    selectedSunAngleSamples = getSunAngleSamples(profile)
    selectedPoint = { lat: profile.lat, lng: profile.lng }
    els.dsm.textContent = profile.dsm
      ? `${profile.dsm.imageryQuality ?? 'DSM'} at ${profile.dsm.pixelSizeXMeters.toFixed(2)}m px`
      : 'DSM loaded'
    updateSunWindows()
    updateForCurrentTime()
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') return
    setMarker(point, 'error')
    marker?.setDayFill()
    marker?.setSunAngle()
    selectedSunAngleSamples = []
    let message = error instanceof Error ? error.message : 'Profile request failed.'
    let isCoverageError = error instanceof HttpError && error.status === 404
    setStatus(isCoverageError ? 'Outside coverage' : 'Profile failed', message, 'error')
    if (!isCoverageError) showErrorToast(message)
    els.windows.innerHTML = ''
  }
}

function updateForCurrentTime() {
  let minutes = Number(els.slider.value)
  let time = dateForMinutes(minutes)
  els.time.textContent = formatTime(time)

  if (!selectedProfile || !selectedPoint) return

  let reading = readSun(selectedProfile, time)
  setMarker(selectedPoint, reading.inSun ? 'sun' : 'shade')
  marker?.setSunAngle(reading.azimuthDeg)
  setStatus(
    reading.inSun ? 'In sun' : 'In shade',
    `${formatTime(time)} - sun altitude ${toDegrees(reading.altitude).toFixed(1)} deg, horizon ${toDegrees(
      reading.horizonAltitude,
    ).toFixed(1)} deg`,
    reading.inSun ? 'sun' : 'shade',
  )
}

function readSun(profile: HorizonResponse, time: Date) {
  let sun = getSunPosition(time, profile.lat, profile.lng)
  let azimuthDeg = ((toDegrees(sun.azimuth) + 180 + 360) % 360)
  let horizonAltitude = profile.horizon[Math.round(azimuthDeg) % 360] ?? Math.PI / 2
  let inSun = sun.altitude > 0 && sun.altitude > horizonAltitude

  return {
    altitude: sun.altitude,
    azimuthDeg,
    horizonAltitude,
    inSun,
  }
}

function updateSunWindows() {
  if (!selectedProfile) return

  let windows = getSunWindows(selectedProfile)

  els.windows.innerHTML = ''
  for (let windowRange of windows) {
    let segment = document.createElement('span')
    segment.title = `${formatMinutes(windowRange.start)}-${formatMinutes(windowRange.end)}`
    segment.style.background = '#f5b93f'
    segment.style.borderRadius = '999px'
    segment.style.height = '100%'
    segment.style.left = `${(windowRange.start / 1440) * 100}%`
    segment.style.position = 'absolute'
    segment.style.top = '0'
    segment.style.width = `${((windowRange.end - windowRange.start) / 1440) * 100}%`
    els.windows.append(segment)
  }

  marker?.setDayFill(buildDayFill())
}

function getSunWindows(profile: HorizonResponse): SunWindow[] {
  let windows: SunWindow[] = []
  let current: { end: number; start: number } | undefined

  for (let minute = 0; minute < 1440; minute += 2) {
    let inSun = readSun(profile, dateForMinutes(minute)).inSun
    if (inSun && !current) current = { start: minute, end: minute + 2 }
    if (inSun && current) current.end = minute + 2
    if (!inSun && current) {
      windows.push(current)
      current = undefined
    }
  }
  if (current) windows.push(current)

  return windows
}

function getSunAngleSamples(profile: HorizonResponse): SunAngleSample[] {
  let samples: SunAngleSample[] = []

  for (let minute = 0; minute < 1440; minute++) {
    let reading = readSun(profile, dateForMinutes(minute))
    samples.push({ azimuthDeg: reading.azimuthDeg, minute })
  }

  return samples
}

function updateTimeFromSunAngle(azimuthDeg: number) {
  if (selectedSunAngleSamples.length === 0) return

  let targetAzimuth = sunAngleDragAzimuth === undefined ? azimuthDeg : unwrapAngleNear(azimuthDeg, sunAngleDragAzimuth)
  sunAngleDragAzimuth = targetAzimuth
  let referenceMinute = sunAngleDragMinute ?? Number(els.slider.value)
  let closest = selectedSunAngleSamples[0]
  let closestUnwrappedMinute = unwrapMinuteNear(closest.minute, referenceMinute)
  let closestScore = Number.POSITIVE_INFINITY

  for (let sample of selectedSunAngleSamples) {
    let unwrappedMinute = unwrapMinuteNear(sample.minute, referenceMinute)
    let angleDistance = Math.abs(unwrapAngleNear(sample.azimuthDeg, targetAzimuth) - targetAzimuth)
    let minuteDistance = Math.abs(unwrappedMinute - referenceMinute) / 1440
    let score = angleDistance + minuteDistance * 0.01
    if (score < closestScore) {
      closest = sample
      closestUnwrappedMinute = unwrappedMinute
      closestScore = score
    }
  }

  sunAngleDragMinute = closestUnwrappedMinute
  els.slider.value = String(wrapMinute(closest.minute))
  updateForCurrentTime()
}

function buildDayFill() {
  if (!selectedProfile) return undefined

  return buildSunBeamFill(selectedProfile)
}

function buildSunBeamFill(profile: HorizonResponse) {
  let shadowFill = 'rgba(83, 97, 111, 0.28)'
  let sunFill = 'rgba(245, 185, 63, 0.42)'
  let sunBins = Array.from({ length: 360 }, () => false)

  for (let minute = 0; minute < 1440; minute += 2) {
    let reading = readSun(profile, dateForMinutes(minute))
    if (!reading.inSun) continue

    let center = Math.round(reading.azimuthDeg) % 360
    for (let offset = -2; offset <= 2; offset++) {
      sunBins[(center + offset + 360) % 360] = true
    }
  }

  if (sunBins.every(Boolean)) return `conic-gradient(from 0deg, ${sunFill} 0deg 360deg)`
  if (!sunBins.some(Boolean)) return `conic-gradient(from 0deg, ${shadowFill} 0deg 360deg)`

  let ranges = getAngleRanges(sunBins)
  let stops: string[] = []
  let cursor = 0

  for (let range of ranges) {
    let start = clampAngle(range.start)
    let end = clampAngle(range.end)
    if (start > cursor) stops.push(`${shadowFill} ${cursor}deg ${start}deg`)
    if (end > start) stops.push(`${sunFill} ${start}deg ${end}deg`)
    cursor = Math.max(cursor, end)
  }

  if (cursor < 360) stops.push(`${shadowFill} ${cursor}deg 360deg`)
  if (stops.length === 0) stops.push(`${shadowFill} 0deg 360deg`)

  return `conic-gradient(from 0deg, ${stops.join(', ')})`
}

function getAngleRanges(sunBins: boolean[]) {
  let firstShadow = sunBins.findIndex((isSun) => !isSun)
  let startIndex = firstShadow === -1 ? 0 : (firstShadow + 1) % sunBins.length
  let ranges: SunWindow[] = []
  let current: SunWindow | undefined

  for (let step = 0; step < sunBins.length; step++) {
    let angle = (startIndex + step) % sunBins.length
    let normalizedAngle = step + startIndex >= sunBins.length ? angle + sunBins.length : angle
    if (sunBins[angle] && !current) current = { start: normalizedAngle, end: normalizedAngle + 1 }
    if (sunBins[angle] && current) current.end = normalizedAngle + 1
    if (!sunBins[angle] && current) {
      ranges.push(current)
      current = undefined
    }
  }
  if (current) ranges.push(current)

  return ranges
    .flatMap((range) => {
      if (range.end <= 360) return [range]
      return [
        { start: 0, end: range.end - 360 },
        { start: range.start, end: 360 },
      ]
    })
    .sort((a, b) => a.start - b.start)
}

function clampAngle(degrees: number) {
  return Math.min(360, Math.max(0, degrees))
}

function unwrapAngleNear(degrees: number, referenceDegrees: number) {
  let turnOffset = Math.round((referenceDegrees - degrees) / 360) * 360
  let candidate = degrees + turnOffset
  if (candidate - referenceDegrees > 180) return candidate - 360
  if (referenceDegrees - candidate > 180) return candidate + 360
  return candidate
}

function unwrapMinuteNear(minute: number, referenceMinute: number) {
  let dayOffset = Math.round((referenceMinute - minute) / 1440) * 1440
  let candidate = minute + dayOffset
  if (candidate - referenceMinute > 720) return candidate - 1440
  if (referenceMinute - candidate > 720) return candidate + 1440
  return candidate
}

function wrapMinute(minute: number) {
  return ((Math.round(minute) % 1440) + 1440) % 1440
}

function setLoading(point: google.maps.LatLngLiteral) {
  els.point.textContent = `${point.lat.toFixed(6)}, ${point.lng.toFixed(6)}`
  els.dsm.textContent = 'Fetching Google Solar DSM'
  setStatus('Computing profile', 'Raymarching 3D buildings and tree canopy around this point.', 'loading')
  hideToast()
}

function setStatus(label: string, detail: string, mode: MarkerMode) {
  els.label.textContent = label
  els.detail.textContent = detail
  let color = mode === 'sun' ? '#f5b93f' : mode === 'shade' ? '#53616f' : mode === 'error' ? '#c94b4b' : '#56a0c8'
  els.dot.style.background = color
  els.dot.style.boxShadow = `0 0 0 6px ${hexToRgba(color, 0.16)}`
}

function setMarker(point: google.maps.LatLngLiteral, mode: MarkerMode) {
  if (!marker) {
    injectMarkerStyles()
    marker = createSunMarkerOverlay(point, mode)
    marker.setMap(map)
    return
  }

  marker.setPosition(point)
  marker.setMode(mode)
}

function createSunMarkerOverlay(point: google.maps.LatLngLiteral, mode: MarkerMode): SunMarkerOverlay {
  let position = point
  let element = document.createElement('div')
  element.className = 'sun-map-marker'
  element.setAttribute('aria-hidden', 'true')
  element.innerHTML = `
    <div class="sun-map-marker__day">
      <span class="sun-map-marker__day-hand"></span>
    </div>
    <div class="sun-map-marker__rays">
      <span></span>
      <span></span>
      <span></span>
    </div>
    <span class="sun-map-marker__cloud sun-map-marker__cloud--one"></span>
    <span class="sun-map-marker__cloud sun-map-marker__cloud--two"></span>
    <span class="sun-map-marker__cloud sun-map-marker__cloud--three"></span>
    <div class="sun-map-marker__core">
      <span class="sun-map-marker__label"></span>
    </div>
  `

  let day = element.querySelector<HTMLElement>('.sun-map-marker__day')!
  let label = element.querySelector<HTMLElement>('.sun-map-marker__label')!
  let renderedSunAngle: number | undefined
  day.title = 'Drag to change time'

  day.addEventListener('pointerdown', (event) => {
    if (!selectedProfile) return
    suppressMapClickAfterMarkerDrag()
    sunAngleDragAzimuth = compassAngleFromPointer(event, element)
    sunAngleDragMinute = Number(els.slider.value)
    event.preventDefault()
    event.stopPropagation()
    day.setPointerCapture(event.pointerId)
    element.dataset.dragging = 'true'
    updateTimeFromSunAngle(compassAngleFromPointer(event, element))
  })

  day.addEventListener('pointermove', (event) => {
    if (element.dataset.dragging !== 'true' || !day.hasPointerCapture(event.pointerId)) return
    suppressMapClickAfterMarkerDrag()
    event.preventDefault()
    event.stopPropagation()
    updateTimeFromSunAngle(compassAngleFromPointer(event, element))
  })

  day.addEventListener('pointerup', (event) => {
    suppressMapClickAfterMarkerDrag()
    event.preventDefault()
    event.stopPropagation()
    if (day.hasPointerCapture(event.pointerId)) day.releasePointerCapture(event.pointerId)
    element.dataset.dragging = 'false'
    sunAngleDragAzimuth = undefined
    sunAngleDragMinute = undefined
  })

  day.addEventListener('pointercancel', (event) => {
    suppressMapClickAfterMarkerDrag()
    event.preventDefault()
    event.stopPropagation()
    if (day.hasPointerCapture(event.pointerId)) day.releasePointerCapture(event.pointerId)
    element.dataset.dragging = 'false'
    sunAngleDragAzimuth = undefined
    sunAngleDragMinute = undefined
  })

  day.addEventListener('click', (event) => {
    suppressMapClickAfterMarkerDrag()
    event.preventDefault()
    event.stopPropagation()
  })

  class MarkerOverlay extends google.maps.OverlayView {
    override onAdd() {
      this.getPanes()?.overlayMouseTarget.append(element)
    }

    override draw() {
      let projection = this.getProjection()
      if (!projection) return

      let pixel = projection.fromLatLngToDivPixel(new google.maps.LatLng(position))
      if (!pixel) return

      element.style.left = `${pixel.x}px`
      element.style.top = `${pixel.y}px`
      element.style.zIndex = String(Math.round(pixel.y))
    }

    override onRemove() {
      element.remove()
    }

    setMode(nextMode: MarkerMode) {
      element.dataset.mode = nextMode
      label.textContent = markerLabelForMode(nextMode)
    }

    setDayFill(fill?: string) {
      if (fill) {
        element.dataset.hasDay = 'true'
        element.style.setProperty('--day-fill', fill)
      } else {
        element.dataset.hasDay = 'false'
        element.style.removeProperty('--day-fill')
      }
    }

    setSunAngle(azimuthDeg?: number) {
      if (azimuthDeg === undefined) {
        renderedSunAngle = undefined
        element.dataset.hasSunAngle = 'false'
        element.style.removeProperty('--sun-angle')
      } else {
        renderedSunAngle = renderedSunAngle === undefined ? azimuthDeg : unwrapAngleNear(azimuthDeg, renderedSunAngle)
        element.dataset.hasSunAngle = 'true'
        element.style.setProperty('--sun-angle', `${renderedSunAngle}deg`)
      }
    }

    setPosition(nextPoint: google.maps.LatLngLiteral) {
      position = nextPoint
      this.draw()
    }
  }

  let overlay = new MarkerOverlay() as SunMarkerOverlay
  overlay.setMode(mode)
  return overlay
}

function compassAngleFromPointer(event: PointerEvent, element: HTMLElement) {
  let rect = element.getBoundingClientRect()
  let x = event.clientX - (rect.left + rect.width / 2)
  let y = event.clientY - (rect.top + rect.height / 2)
  return (toDegrees(Math.atan2(x, -y)) + 360) % 360
}

function suppressMapClickAfterMarkerDrag() {
  suppressMapClickUntil = Date.now() + 450
}

function markerLabelForMode(mode: MarkerMode) {
  return mode === 'sun' ? 'SUN' : mode === 'shade' ? 'SHADE' : mode === 'error' ? 'ERR' : ''
}

function injectMarkerStyles() {
  if (document.querySelector('#sun-map-marker-style')) return

  let style = document.createElement('style')
  style.id = 'sun-map-marker-style'
  style.textContent = `
    .sun-map-marker {
      --day-fill: conic-gradient(from 0deg, rgba(86, 160, 200, 0.16) 0turn 1turn);
      --marker-color: #56a0c8;
      --marker-shadow: rgba(86, 160, 200, 0.28);
      --sun-angle: 0deg;
      height: 168px;
      left: 0;
      pointer-events: none;
      position: absolute;
      top: 0;
      transform: translate(-50%, -50%);
      user-select: none;
      width: 168px;
    }

    .sun-map-marker__day {
      background: var(--day-fill);
      border: 1px solid rgba(255, 255, 255, 0.66);
      border-radius: 999px;
      box-shadow:
        inset 0 0 0 1px rgba(23, 32, 29, 0.08),
        0 14px 36px var(--marker-shadow);
      inset: 0;
      opacity: 0.38;
      overflow: hidden;
      pointer-events: none;
      position: absolute;
      touch-action: none;
      transition: box-shadow 160ms ease, filter 160ms ease, opacity 180ms ease, transform 160ms ease;
    }

    .sun-map-marker[data-has-day="true"] .sun-map-marker__day {
      cursor: grab;
      opacity: 1;
      pointer-events: auto;
    }

    .sun-map-marker[data-dragging="true"] .sun-map-marker__day {
      cursor: grabbing;
    }

    .sun-map-marker[data-has-day="true"] .sun-map-marker__day:hover,
    .sun-map-marker[data-dragging="true"] .sun-map-marker__day {
      box-shadow:
        inset 0 0 0 2px rgba(23, 32, 29, 0.22),
        inset 0 0 0 999px rgba(23, 32, 29, 0.07),
        0 18px 42px var(--marker-shadow);
      filter: saturate(1.08);
      transform: scale(1.025);
    }

    .sun-map-marker__day::before {
      background: repeating-conic-gradient(
        from 0deg,
        rgba(255, 255, 255, 0.52) 0deg 0.7deg,
        transparent 0.7deg 15deg
      );
      border-radius: inherit;
      content: "";
      inset: 0;
      mask: radial-gradient(circle, transparent 0 57%, #000 58% 100%);
      position: absolute;
      -webkit-mask: radial-gradient(circle, transparent 0 57%, #000 58% 100%);
    }

    .sun-map-marker__day::after {
      background: radial-gradient(circle, rgba(255, 255, 255, 0.5) 0 20%, rgba(255, 255, 255, 0) 58%);
      border-radius: inherit;
      content: "";
      inset: 0;
      position: absolute;
    }

    .sun-map-marker__day-hand {
      inset: 0;
      position: absolute;
      opacity: 0;
      transform: rotate(var(--sun-angle));
      transform-origin: 50% 50%;
      transition: opacity 160ms ease, transform 120ms linear;
    }

    .sun-map-marker[data-has-sun-angle="true"] .sun-map-marker__day-hand {
      opacity: 1;
    }

    .sun-map-marker__day-hand::before {
      background: linear-gradient(180deg, rgba(23, 32, 29, 0.58), rgba(23, 32, 29, 0));
      border-radius: 999px;
      content: "";
      height: 70px;
      left: 50%;
      position: absolute;
      top: 12px;
      transform: translateX(-50%);
      width: 2px;
    }

    .sun-map-marker__day-hand::after {
      background: #ffffff;
      border: 2px solid rgba(23, 32, 29, 0.5);
      border-radius: 999px;
      box-shadow: 0 3px 8px rgba(23, 32, 29, 0.2);
      content: "";
      height: 10px;
      left: 50%;
      position: absolute;
      top: 8px;
      transform: translateX(-50%);
      width: 10px;
    }

    .sun-map-marker[data-mode="sun"] {
      --marker-color: #f5b93f;
      --marker-shadow: rgba(245, 185, 63, 0.3);
    }

    .sun-map-marker[data-mode="shade"] {
      --marker-color: #53616f;
      --marker-shadow: rgba(83, 97, 111, 0.26);
    }

    .sun-map-marker[data-mode="error"] {
      --marker-color: #c94b4b;
      --marker-shadow: rgba(201, 75, 75, 0.26);
    }

    .sun-map-marker__core {
      align-items: center;
      background: var(--marker-color);
      border: 2px solid #ffffff;
      border-radius: 999px;
      box-shadow: 0 10px 24px var(--marker-shadow);
      color: #ffffff;
      display: flex;
      height: 44px;
      justify-content: center;
      left: 50%;
      position: absolute;
      top: 50%;
      transform: translate(-50%, -50%);
      width: 44px;
    }

    .sun-map-marker__label {
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      font-size: 10px;
      font-weight: 800;
      letter-spacing: 0;
      line-height: 1;
    }

    .sun-map-marker__rays,
    .sun-map-marker__cloud {
      opacity: 0;
      position: absolute;
    }

    .sun-map-marker[data-mode="loading"] .sun-map-marker__core::before {
      animation: sun-marker-center-spin 760ms linear infinite;
      border: 3px solid rgba(255, 232, 176, 0.58);
      border-radius: 999px;
      border-top-color: #ffffff;
      box-shadow: 0 0 0 1px rgba(255, 198, 76, 0.28);
      content: "";
      height: 18px;
      width: 18px;
    }

    .sun-map-marker[data-mode="loading"] .sun-map-marker__core {
      animation: sun-marker-bob 980ms ease-in-out infinite;
      background: #f5b93f;
      box-shadow: 0 12px 28px rgba(245, 185, 63, 0.32);
    }

    .sun-map-marker[data-mode="loading"] .sun-map-marker__rays {
      animation: sun-marker-turn 3.2s linear infinite;
      height: 78px;
      left: 45px;
      opacity: 1;
      top: 45px;
      width: 78px;
    }

    .sun-map-marker[data-mode="loading"] .sun-map-marker__rays span {
      background: linear-gradient(90deg, rgba(245, 185, 63, 0), rgba(245, 185, 63, 0.38), rgba(245, 185, 63, 0));
      border-radius: 999px;
      height: 13px;
      left: 0;
      position: absolute;
      top: 32px;
      width: 78px;
    }

    .sun-map-marker[data-mode="loading"] .sun-map-marker__rays span:nth-child(2) {
      transform: rotate(60deg);
    }

    .sun-map-marker[data-mode="loading"] .sun-map-marker__rays span:nth-child(3) {
      transform: rotate(120deg);
    }

    .sun-map-marker__cloud {
      --cloud-pop-scale: 1;
      --cloud-scale: 0.82;
      background: #ffffff;
      border-radius: 999px;
      box-shadow: 0 8px 18px rgba(45, 70, 78, 0.16);
      height: 15px;
      width: 36px;
    }

    .sun-map-marker__cloud::before,
    .sun-map-marker__cloud::after {
      background: #ffffff;
      border-radius: 999px;
      content: "";
      position: absolute;
    }

    .sun-map-marker__cloud::before {
      height: 18px;
      left: 7px;
      top: -8px;
      width: 18px;
    }

    .sun-map-marker__cloud::after {
      height: 13px;
      right: 7px;
      top: -5px;
      width: 13px;
    }

    .sun-map-marker__cloud--one {
      left: 52px;
      top: 68px;
      transform: scale(var(--cloud-scale));
    }

    .sun-map-marker__cloud--two {
      --cloud-pop-scale: 0.9;
      --cloud-scale: 0.72;
      right: 48px;
      top: 70px;
      transform: scale(var(--cloud-scale));
    }

    .sun-map-marker__cloud--three {
      --cloud-pop-scale: 0.82;
      --cloud-scale: 0.64;
      bottom: 56px;
      left: 76px;
      transform: scale(var(--cloud-scale));
    }

    .sun-map-marker[data-mode="loading"] .sun-map-marker__cloud {
      animation: sun-marker-cloud 1.9s ease-in-out infinite;
      opacity: 0.96;
    }

    .sun-map-marker[data-mode="loading"] .sun-map-marker__cloud--two {
      animation-delay: 260ms;
    }

    .sun-map-marker[data-mode="loading"] .sun-map-marker__cloud--three {
      animation-delay: 520ms;
    }

    @keyframes sun-marker-bob {
      0%, 100% { transform: translate(-50%, -52%); }
      50% { transform: translate(-50%, -44%); }
    }

    @keyframes sun-marker-turn {
      to { transform: rotate(360deg); }
    }

    @keyframes sun-marker-center-spin {
      to { transform: rotate(360deg); }
    }

    @keyframes sun-marker-cloud {
      0%, 100% {
        opacity: 0;
        transform: translate(0, 5px) scale(var(--cloud-scale));
      }
      18%, 76% {
        opacity: 0.96;
      }
      48% {
        transform: translate(0, -2px) scale(var(--cloud-pop-scale));
      }
    }

    @media (prefers-reduced-motion: reduce) {
      .sun-map-marker[data-mode="loading"] .sun-map-marker__core,
      .sun-map-marker[data-mode="loading"] .sun-map-marker__core::before,
      .sun-map-marker[data-mode="loading"] .sun-map-marker__rays,
      .sun-map-marker[data-mode="loading"] .sun-map-marker__cloud {
        animation: none;
      }

      .sun-map-marker[data-mode="loading"] .sun-map-marker__rays,
      .sun-map-marker[data-mode="loading"] .sun-map-marker__cloud {
        opacity: 1;
      }
    }
  `
  document.head.append(style)
}

function setSliderToNow() {
  let now = new Date()
  let minutes = now.getHours() * 60 + now.getMinutes()
  els.slider.value = String(minutes)
  els.time.textContent = formatTime(now)
}

function dateForMinutes(minutes: number) {
  let date = new Date()
  date.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0)
  return date
}

function formatTime(date: Date) {
  return formatMinutes(date.getHours() * 60 + date.getMinutes())
}

function formatMinutes(minutes: number) {
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`
}

async function loadGoogleMaps(apiKey: string): Promise<void> {
  if (window.google?.maps) return
  let lastError: Error | undefined
  for (let i = 0; i < 3; i++) {
    if (i > 0) {
      document.querySelector('script[src*="maps.googleapis.com"]')?.remove()
      await new Promise((resolve) => setTimeout(resolve, 1500))
    }
    try {
      await loadGoogleMapsScript(apiKey)
      return
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Google Maps JavaScript failed to load.')
    }
  }
  throw lastError ?? new Error('Google Maps JavaScript failed to load.')
}

function loadGoogleMapsScript(apiKey: string): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    let timeout = setTimeout(() => reject(new Error('Google Maps JavaScript timed out.')), 10_000)
    window.__initSunMap = () => {
      clearTimeout(timeout)
      resolve()
    }
    let script = document.createElement('script')
    script.async = true
    script.onerror = () => {
      clearTimeout(timeout)
      reject(new Error('Google Maps JavaScript failed to load.'))
    }
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(
      apiKey,
    )}&v=weekly&loading=async&callback=__initSunMap`
    document.head.append(script)
  })
}

async function fetchWithRetry<T>(url: string, attempts: number, delayMs: number): Promise<T> {
  for (let i = 0; i < attempts; i++) {
    try {
      return await fetchJson<T>(url)
    } catch (error) {
      if (i === attempts - 1) throw error
      await new Promise((resolve) => setTimeout(resolve, delayMs))
    }
  }
  throw new Error('unreachable')
}

async function fetchJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  let response = await fetch(url, { signal })
  if (!response.ok) {
    let body = await response.json().catch(() => undefined)
    let message =
      body && typeof body === 'object' && 'error' in body
        ? String((body as { error: unknown }).error)
        : `Request failed with ${response.status}`
    throw new HttpError(message, response.status)
  }
  return response.json() as Promise<T>
}

function showErrorToast(message: string) {
  els.toast.textContent = message
  els.toast.style.opacity = '1'
}

function hideToast() {
  els.toast.style.opacity = '0'
}

function toDegrees(radians: number) {
  return (radians * 180) / Math.PI
}

function hexToRgba(hex: string, alpha: number) {
  let value = Number.parseInt(hex.slice(1), 16)
  let r = (value >> 16) & 255
  let g = (value >> 8) & 255
  let b = value & 255
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

function getSunPosition(date: Date, lat: number, lng: number) {
  let rad = Math.PI / 180
  let dayMs = 1000 * 60 * 60 * 24
  let julianDate = date.getTime() / dayMs - 0.5 + 2440588
  let daysSinceJ2000 = julianDate - 2451545

  let meanAnomaly = rad * (357.5291 + 0.98560028 * daysSinceJ2000)
  let equationOfCenter =
    rad * (1.9148 * Math.sin(meanAnomaly) + 0.02 * Math.sin(2 * meanAnomaly) + 0.0003 * Math.sin(3 * meanAnomaly))
  let eclipticLongitude = meanAnomaly + equationOfCenter + rad * 102.9372 + Math.PI
  let obliquity = rad * 23.4397

  let declination = Math.asin(Math.sin(eclipticLongitude) * Math.sin(obliquity))
  let rightAscension = Math.atan2(
    Math.sin(eclipticLongitude) * Math.cos(obliquity),
    Math.cos(eclipticLongitude),
  )
  let siderealTime = rad * (280.16 + 360.9856235 * daysSinceJ2000) - lng * rad
  let hourAngle = siderealTime - rightAscension
  let latitude = lat * rad

  let altitude = Math.asin(
    Math.sin(latitude) * Math.sin(declination) +
      Math.cos(latitude) * Math.cos(declination) * Math.cos(hourAngle),
  )
  let azimuth = Math.atan2(
    Math.sin(hourAngle),
    Math.cos(hourAngle) * Math.sin(latitude) - Math.tan(declination) * Math.cos(latitude),
  )

  return { altitude, azimuth }
}
