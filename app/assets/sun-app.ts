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

type SunReading = {
  altitude: number
  azimuthDeg: number
  horizonAltitude: number
  inSun: boolean
}

type SkyStop = {
  altitudeDeg: number
  bottom: string
  glowAlpha: number
  glowColor: string
  mapBottom: string
  mapTop: string
  mid: string
  overlayOpacity: number
  starOpacity: number
  top: string
}

type SkyTheme = Omit<SkyStop, 'altitudeDeg'>

type Rgb = { b: number; g: number; r: number }

type UiTheme = {
  brandText: string
  cardBg: string
  cardBorder: string
  cardHighlight: string
  controlBg: string
  controlBorder: string
  controlHoverBg: string
  controlHoverBorder: string
  divider: string
  errorText: string
  focus: string
  label: string
  logoShadow: string
  statusDivider: string
  text: string
  textMuted: string
  windowBg: string
}

type MarkerDragHandle = HTMLElement & {
  hasPointerCapture(pointerId: number): boolean
  releasePointerCapture(pointerId: number): void
  setPointerCapture(pointerId: number): void
}

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

const SKY_STOPS: SkyStop[] = [
  {
    altitudeDeg: -18,
    bottom: '#101d33',
    glowAlpha: 0.08,
    glowColor: '#aebeea',
    mapBottom: '#050914',
    mapTop: '#10203a',
    mid: '#0a1830',
    overlayOpacity: 0.42,
    starOpacity: 0.9,
    top: '#06101f',
  },
  {
    altitudeDeg: -8,
    bottom: '#6c5d8a',
    glowAlpha: 0.18,
    glowColor: '#d88fe4',
    mapBottom: '#1a1230',
    mapTop: '#1f2a55',
    mid: '#26315d',
    overlayOpacity: 0.35,
    starOpacity: 0.5,
    top: '#101d3f',
  },
  {
    altitudeDeg: -2,
    bottom: '#f1a263',
    glowAlpha: 0.42,
    glowColor: '#ffb25f',
    mapBottom: '#a8425c',
    mapTop: '#405884',
    mid: '#b06991',
    overlayOpacity: 0.28,
    starOpacity: 0.15,
    top: '#32477d',
  },
  {
    altitudeDeg: 3,
    bottom: '#ffd07b',
    glowAlpha: 0.7,
    glowColor: '#ff994e',
    mapBottom: '#e78c47',
    mapTop: '#6789b8',
    mid: '#e08294',
    overlayOpacity: 0.22,
    starOpacity: 0,
    top: '#5578b5',
  },
  {
    altitudeDeg: 9,
    bottom: '#ffe4a8',
    glowAlpha: 0.58,
    glowColor: '#ffc45f',
    mapBottom: '#f3c76d',
    mapTop: '#83b8dd',
    mid: '#f4c879',
    overlayOpacity: 0.13,
    starOpacity: 0,
    top: '#6aaedf',
  },
  {
    altitudeDeg: 22,
    bottom: '#dbefff',
    glowAlpha: 0.35,
    glowColor: '#ffdc86',
    mapBottom: '#f7dd97',
    mapTop: '#73b7e6',
    mid: '#98cdf0',
    overlayOpacity: 0.08,
    starOpacity: 0,
    top: '#5eabdf',
  },
  {
    altitudeDeg: 90,
    bottom: '#d9f3ff',
    glowAlpha: 0.26,
    glowColor: '#fff0aa',
    mapBottom: '#e5f0c7',
    mapTop: '#5fb4e8',
    mid: '#7ec8ef',
    overlayOpacity: 0.06,
    starOpacity: 0,
    top: '#3b9cda',
  },
]

const SKY_TRANSITION_MS = 1250

let map: google.maps.Map
let marker: SunMarkerOverlay | undefined
let selectedSunAngleSamples: SunAngleSample[] = []
let selectedProfile: HorizonResponse | undefined
let selectedPoint: google.maps.LatLngLiteral | undefined
let selectPointController: AbortController | undefined
let suppressMapClickUntil = 0
let ambientSkyPoint: google.maps.LatLngLiteral | undefined
let renderedSkyTheme: SkyTheme | undefined
let skyAnimationFrame: number | undefined
let skyTransition: { from: SkyTheme; startedAt: number; to: SkyTheme } | undefined
let sunAngleDragAzimuth: number | undefined
let sunAngleDragMinute: number | undefined
let markerDragMapOptions: google.maps.MapOptions | undefined

const els = {
  copyLink: document.querySelector<HTMLButtonElement>('#copy-link-button')!,
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
  ambientSkyPoint = config.city
  updateForCurrentTime()
  await loadGoogleMaps(config.googleMapsApiKey)

  map = new google.maps.Map(els.map, {
    center: config.city,
    clickableIcons: false,
    fullscreenControl: false,
    gestureHandling: 'greedy',
    mapTypeControl: true,
    mapTypeId: google.maps.MapTypeId.ROADMAP,
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
  els.copyLink.addEventListener('click', () => {
    void copyShareableLink()
  })

  void setupPlaceSearch(config.city).catch((error) => {
    setPlaceSearchMessage(error instanceof Error ? error.message : 'Address search is unavailable.')
  })

  let sharedPoint = pointFromSearchParams()
  if (sharedPoint) {
    map.setCenter(sharedPoint)
    map.setZoom(Math.max(map.getZoom() ?? 0, 17))
    void selectPoint(sharedPoint)
  } else {
    updateForCurrentTime()
  }
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
  syncPlaceAutocompleteStyles()
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

  els.useLocation.disabled = true
  els.useLocation.setAttribute('aria-busy', 'true')
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
    els.useLocation.removeAttribute('aria-busy')
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

function pointFromSearchParams() {
  let params = new URLSearchParams(window.location.search)
  let lat = parseCoordinate(params.get('lat'))
  let lng = parseCoordinate(params.get('lng'))
  if (lat === undefined || lng === undefined) return undefined
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return undefined

  return { lat, lng }
}

function parseCoordinate(value: string | null) {
  if (!value) return undefined

  let coordinate = Number(value)
  return Number.isFinite(coordinate) ? coordinate : undefined
}

function updateShareablePointUrl(point: google.maps.LatLngLiteral) {
  let url = new URL(window.location.href)
  url.searchParams.set('lat', formatCoordinate(point.lat))
  url.searchParams.set('lng', formatCoordinate(point.lng))
  window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`)
  els.copyLink.disabled = false
  els.copyLink.textContent = 'Copy link'
}

function formatCoordinate(coordinate: number) {
  return coordinate.toFixed(6).replace(/\.?0+$/, '')
}

async function copyShareableLink() {
  if (!selectedPoint || els.copyLink.disabled) return

  let previousText = 'Copy link'
  els.copyLink.disabled = true

  try {
    await navigator.clipboard.writeText(window.location.href)
    els.copyLink.textContent = 'Copied'
  } catch {
    els.copyLink.textContent = 'Copy failed'
  } finally {
    window.setTimeout(() => {
      els.copyLink.textContent = previousText
      els.copyLink.disabled = !selectedPoint
    }, 1400)
  }
}

async function selectPoint(point: google.maps.LatLngLiteral) {
  selectPointController?.abort()
  selectPointController = new AbortController()
  const signal = selectPointController.signal

  selectedPoint = point
  updateShareablePointUrl(point)
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
    updateShareablePointUrl(selectedPoint)
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

  let skyReading = selectedProfile
    ? readSun(selectedProfile, time)
    : selectedPoint
      ? readSkySun(selectedPoint, time)
      : ambientSkyPoint
        ? readSkySun(ambientSkyPoint, time)
        : undefined
  if (skyReading) applySkyTheme(skyReading)

  if (!selectedProfile || !selectedPoint) return

  let reading = skyReading ?? readSun(selectedProfile, time)
  setMarker(selectedPoint, reading.inSun ? 'sun' : 'shade')
  marker?.setSunAngle(reading.azimuthDeg)
  setStatus(
    reading.inSun ? 'In sun' : 'In shade',
    `${formatTime(time)} - sun altitude ${toDegrees(reading.altitude).toFixed(1)}°, horizon ${toDegrees(
      reading.horizonAltitude,
    ).toFixed(1)}°`,
    reading.inSun ? 'sun' : 'shade',
  )
}

function readSun(profile: HorizonResponse, time: Date): SunReading {
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

function readSkySun(point: google.maps.LatLngLiteral, time: Date): SunReading {
  let sun = getSunPosition(time, point.lat, point.lng)
  let azimuthDeg = ((toDegrees(sun.azimuth) + 180 + 360) % 360)

  return {
    altitude: sun.altitude,
    azimuthDeg,
    horizonAltitude: 0,
    inSun: sun.altitude > 0,
  }
}

function applySkyTheme(reading: SunReading) {
  let targetTheme = getSkyTheme(reading)
  if (!renderedSkyTheme) {
    renderedSkyTheme = targetTheme
    writeSkyTheme(targetTheme)
    return
  }

  skyTransition = {
    from: renderedSkyTheme,
    startedAt: performance.now(),
    to: targetTheme,
  }
  if (skyAnimationFrame === undefined) {
    skyAnimationFrame = requestAnimationFrame(animateSkyTheme)
  }
}

function getSkyTheme(reading: SunReading): SkyTheme {
  let altitudeDeg = toDegrees(reading.altitude)
  let horizonDeg = toDegrees(reading.horizonAltitude)
  let clearanceDeg = altitudeDeg - Math.max(0, horizonDeg)
  let stop = interpolateSkyStop(altitudeDeg)
  let horizonShade = altitudeDeg > 0 && clearanceDeg < 0 ? clamp01(Math.abs(clearanceDeg) / 12) : 0

  return {
    bottom: horizonShade > 0 ? mixHex(stop.bottom, '#c5d3d8', horizonShade * 0.28) : stop.bottom,
    glowAlpha: stop.glowAlpha * (1 - horizonShade * 0.58),
    glowColor: stop.glowColor,
    mapBottom: stop.mapBottom,
    mapTop: stop.mapTop,
    mid: horizonShade > 0 ? mixHex(stop.mid, '#6f8da3', horizonShade * 0.35) : stop.mid,
    overlayOpacity: Math.min(0.52, stop.overlayOpacity + horizonShade * 0.08),
    starOpacity: stop.starOpacity,
    top: horizonShade > 0 ? mixHex(stop.top, '#2b4f70', horizonShade * 0.45) : stop.top,
  }
}

function animateSkyTheme(time: number) {
  skyAnimationFrame = undefined
  if (!skyTransition) return

  let amount = smoothstep((time - skyTransition.startedAt) / SKY_TRANSITION_MS)
  renderedSkyTheme = mixSkyTheme(skyTransition.from, skyTransition.to, amount)
  writeSkyTheme(renderedSkyTheme)

  if (amount < 1) {
    skyAnimationFrame = requestAnimationFrame(animateSkyTheme)
    return
  }

  renderedSkyTheme = skyTransition.to
  writeSkyTheme(renderedSkyTheme)
  skyTransition = undefined
}

function writeSkyTheme(theme: SkyTheme) {
  let bodyStyle = document.body.style
  let uiTheme = getUiTheme(theme)

  bodyStyle.setProperty('--sky-top', theme.top)
  bodyStyle.setProperty('--sky-mid', theme.mid)
  bodyStyle.setProperty('--sky-bottom', theme.bottom)
  bodyStyle.setProperty(
    '--sky-glow',
    hexToRgba(theme.glowColor, theme.glowAlpha),
  )
  bodyStyle.setProperty('--sky-star-opacity', String(theme.starOpacity))
  bodyStyle.setProperty(
    '--map-sky-gradient',
    `linear-gradient(180deg, ${hexToRgba(theme.mapTop, 0.72)}, ${hexToRgba(theme.mapBottom, 0.42)})`,
  )
  bodyStyle.setProperty('--map-sky-opacity', String(theme.overlayOpacity))
  writeUiTheme(uiTheme)
}

function mixSkyTheme(from: SkyTheme, to: SkyTheme, amount: number): SkyTheme {
  return {
    bottom: mixHex(from.bottom, to.bottom, amount),
    glowAlpha: mixNumber(from.glowAlpha, to.glowAlpha, amount),
    glowColor: mixHex(from.glowColor, to.glowColor, amount),
    mapBottom: mixHex(from.mapBottom, to.mapBottom, amount),
    mapTop: mixHex(from.mapTop, to.mapTop, amount),
    mid: mixHex(from.mid, to.mid, amount),
    overlayOpacity: mixNumber(from.overlayOpacity, to.overlayOpacity, amount),
    starOpacity: mixNumber(from.starOpacity, to.starOpacity, amount),
    top: mixHex(from.top, to.top, amount),
  }
}

function getUiTheme(theme: SkyTheme): UiTheme {
  let brightness =
    perceivedBrightness(theme.top) * 0.28 +
    perceivedBrightness(theme.mid) * 0.44 +
    perceivedBrightness(theme.bottom) * 0.28
  let darkAmount = smoothstep((152 - brightness) / 76)
  let warmAmount = clamp01((colorWarmth(theme.bottom) + colorWarmth(theme.mid)) / 210)
  let middleContrast = smoothstep(1 - Math.abs(brightness - 164) / 76)
  let twilightTextBoost = smoothstep((warmAmount - 0.18) / 0.36) * smoothstep((166 - brightness) / 34)
  let rawTextAmount = Math.max(smoothstep((156 - brightness) / 30), twilightTextBoost)
  let textAmount = smoothstep((rawTextAmount - 0.44) / 0.12)
  let surfaceAmount = Math.max(darkAmount, textAmount * 0.82)
  let glassAlpha = Math.min(0.56, mixNumber(0.24, 0.4, surfaceAmount) + middleContrast * 0.08)
  let controlAlpha = Math.min(0.58, mixNumber(0.24, 0.44, surfaceAmount) + middleContrast * 0.08)
  let borderAlpha = Math.min(0.66, mixNumber(0.36, 0.52, surfaceAmount) + middleContrast * 0.1)
  let hoverAlpha = Math.min(0.66, mixNumber(0.34, 0.54, surfaceAmount) + middleContrast * 0.08)

  return {
    brandText: mixHex('#31413a', '#f6f1e8', textAmount),
    cardBg: hexToRgba(mixHex('#ffffff', '#071226', surfaceAmount), glassAlpha),
    cardBorder: hexToRgba(mixHex('#ffffff', '#d8e5ff', surfaceAmount), borderAlpha),
    cardHighlight: hexToRgba('#ffffff', mixNumber(0.2, 0.14, surfaceAmount)),
    controlBg: hexToRgba(mixHex('#ffffff', '#071226', surfaceAmount), controlAlpha),
    controlBorder: hexToRgba(mixHex('#ffffff', '#d8e5ff', surfaceAmount), borderAlpha),
    controlHoverBg: hexToRgba(mixHex('#ffffff', '#0f213b', surfaceAmount), hoverAlpha),
    controlHoverBorder: hexToRgba(mixHex('#ffffff', '#ffffff', surfaceAmount), hoverAlpha),
    divider: hexToRgba(mixHex('#d7ddd2', '#dce8ff', surfaceAmount), mixNumber(0.76, 0.38, surfaceAmount)),
    errorText: mixHex('#b14242', '#ffd0d0', darkAmount),
    focus: hexToRgba(mixHex('#56a0c8', '#ffe19a', warmAmount * 0.45 + darkAmount * 0.25), 0.46),
    label: mixHex('#34413b', '#dbe8f8', textAmount),
    logoShadow: hexToRgba(mixHex('#f5b93f', '#ffd98a', surfaceAmount), mixNumber(0.25, 0.36, surfaceAmount)),
    statusDivider: hexToRgba(mixHex('#edf1ea', '#dce8ff', surfaceAmount), mixNumber(0.82, 0.28, surfaceAmount)),
    text: mixHex('#17201d', '#fbf7ef', textAmount),
    textMuted: mixHex('#4f5c55', '#cfdbeb', textAmount),
    windowBg: hexToRgba(mixHex('#dfe5db', '#0b1830', surfaceAmount), mixNumber(0.72, 0.42, surfaceAmount)),
  }
}

function writeUiTheme(theme: UiTheme) {
  let bodyStyle = document.body.style

  bodyStyle.setProperty('--ui-brand-text', theme.brandText)
  bodyStyle.setProperty('--ui-card-bg', theme.cardBg)
  bodyStyle.setProperty('--ui-card-border', theme.cardBorder)
  bodyStyle.setProperty('--ui-card-highlight', theme.cardHighlight)
  bodyStyle.setProperty('--ui-control-bg', theme.controlBg)
  bodyStyle.setProperty('--ui-control-border', theme.controlBorder)
  bodyStyle.setProperty('--ui-control-hover-bg', theme.controlHoverBg)
  bodyStyle.setProperty('--ui-control-hover-border', theme.controlHoverBorder)
  bodyStyle.setProperty('--ui-divider', theme.divider)
  bodyStyle.setProperty('--ui-error-text', theme.errorText)
  bodyStyle.setProperty('--ui-focus', theme.focus)
  bodyStyle.setProperty('--ui-label', theme.label)
  bodyStyle.setProperty('--ui-logo-shadow', theme.logoShadow)
  bodyStyle.setProperty('--ui-status-divider', theme.statusDivider)
  bodyStyle.setProperty('--ui-text', theme.text)
  bodyStyle.setProperty('--ui-text-muted', theme.textMuted)
  bodyStyle.setProperty('--ui-window-bg', theme.windowBg)
  syncPlaceAutocompleteStyles(theme)
}

function syncPlaceAutocompleteStyles(theme?: UiTheme) {
  let bodyStyle = getComputedStyle(document.body)
  let text = theme?.text ?? bodyStyle.getPropertyValue('--ui-text').trim()
  let placeholder = theme?.textMuted ?? bodyStyle.getPropertyValue('--ui-text-muted').trim()

  for (let element of document.querySelectorAll<HTMLElement>('gmp-place-autocomplete')) {
    element.style.setProperty('--utepils-place-text', text)
    element.style.setProperty('--utepils-place-placeholder', placeholder)

    let root = element.shadowRoot
    if (!root || root.querySelector('#utepils-place-autocomplete-style')) continue

    let style = document.createElement('style')
    style.id = 'utepils-place-autocomplete-style'
    style.textContent = `
      input,
      textarea,
      [part~="input"] {
        color: var(--utepils-place-text) !important;
      }

      input::placeholder,
      textarea::placeholder,
      [part~="input"]::placeholder,
      input::-webkit-input-placeholder,
      textarea::-webkit-input-placeholder,
      input::-moz-placeholder,
      textarea::-moz-placeholder,
      input:-ms-input-placeholder,
      textarea:-ms-input-placeholder,
      input::-ms-input-placeholder,
      textarea::-ms-input-placeholder {
        color: var(--utepils-place-placeholder) !important;
        opacity: 1 !important;
      }
    `
    root.append(style)
  }
}

function interpolateSkyStop(altitudeDeg: number): SkyStop {
  let first = SKY_STOPS[0]!
  if (altitudeDeg <= first.altitudeDeg) return first

  for (let i = 1; i < SKY_STOPS.length; i++) {
    let previous = SKY_STOPS[i - 1]!
    let next = SKY_STOPS[i]!
    if (altitudeDeg <= next.altitudeDeg) {
      let amount = smoothstep((altitudeDeg - previous.altitudeDeg) / (next.altitudeDeg - previous.altitudeDeg))
      return {
        altitudeDeg,
        bottom: mixHex(previous.bottom, next.bottom, amount),
        glowAlpha: mixNumber(previous.glowAlpha, next.glowAlpha, amount),
        glowColor: mixHex(previous.glowColor, next.glowColor, amount),
        mapBottom: mixHex(previous.mapBottom, next.mapBottom, amount),
        mapTop: mixHex(previous.mapTop, next.mapTop, amount),
        mid: mixHex(previous.mid, next.mid, amount),
        overlayOpacity: mixNumber(previous.overlayOpacity, next.overlayOpacity, amount),
        starOpacity: mixNumber(previous.starOpacity, next.starOpacity, amount),
        top: mixHex(previous.top, next.top, amount),
      }
    }
  }

  return SKY_STOPS[SKY_STOPS.length - 1]!
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
  let core = element.querySelector<HTMLElement>('.sun-map-marker__core')!
  let label = element.querySelector<HTMLElement>('.sun-map-marker__label')!
  let renderedSunAngle: number | undefined
  day.title = 'Drag to change time'
  core.title = 'Drag to move location'

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
  bindSunAngleDragHandle(day, element)
  bindMarkerPositionDragHandle(core, element, overlay)
  return overlay
}

function bindSunAngleDragHandle(handle: MarkerDragHandle, element: HTMLElement) {
  let pendingDragAzimuth: number | undefined
  let dragFrame: number | undefined

  handle.addEventListener('pointerdown', (event) => {
    if (!selectedProfile) return
    suspendMapGesturesForMarkerDrag()
    suppressMapClickAfterMarkerDrag()
    let azimuthDeg = compassAngleFromPointer(event, element)
    sunAngleDragAzimuth = azimuthDeg
    sunAngleDragMinute = Number(els.slider.value)
    event.preventDefault()
    event.stopPropagation()
    handle.setPointerCapture(event.pointerId)
    element.dataset.dragging = 'time'
    setDraggedSunAngle(element, azimuthDeg)
    updateTimeFromSunAngle(azimuthDeg)
  })

  handle.addEventListener('pointermove', (event) => {
    if (element.dataset.dragging !== 'time' || !handle.hasPointerCapture(event.pointerId)) return
    suppressMapClickAfterMarkerDrag()
    event.preventDefault()
    event.stopPropagation()
    let azimuthDeg = compassAngleFromPointer(event, element)
    setDraggedSunAngle(element, azimuthDeg)
    scheduleDraggedTimeUpdate(azimuthDeg)
  })

  handle.addEventListener('pointerup', (event) => {
    suppressMapClickAfterMarkerDrag()
    event.preventDefault()
    event.stopPropagation()
    if (element.dataset.dragging === 'time') {
      flushDraggedTimeUpdate(compassAngleFromPointer(event, element))
    }
    if (handle.hasPointerCapture(event.pointerId)) handle.releasePointerCapture(event.pointerId)
    finishSunAngleDrag(element)
  })

  handle.addEventListener('pointercancel', (event) => {
    suppressMapClickAfterMarkerDrag()
    event.preventDefault()
    event.stopPropagation()
    if (handle.hasPointerCapture(event.pointerId)) handle.releasePointerCapture(event.pointerId)
    cancelDraggedTimeUpdate()
    finishSunAngleDrag(element)
  })

  handle.addEventListener('click', (event) => {
    suppressMapClickAfterMarkerDrag()
    event.preventDefault()
    event.stopPropagation()
  })

  handle.addEventListener('touchstart', preventMarkerTouchGesture, { passive: false })
  handle.addEventListener('touchmove', preventMarkerTouchGesture, { passive: false })

  function setDraggedSunAngle(draggedElement: HTMLElement, azimuthDeg: number) {
    let referenceAzimuth = sunAngleDragAzimuth ?? azimuthDeg
    draggedElement.dataset.hasSunAngle = 'true'
    draggedElement.style.setProperty('--sun-angle', `${unwrapAngleNear(azimuthDeg, referenceAzimuth)}deg`)
  }

  function scheduleDraggedTimeUpdate(azimuthDeg: number) {
    pendingDragAzimuth = azimuthDeg
    if (dragFrame !== undefined) return

    dragFrame = requestAnimationFrame(() => {
      dragFrame = undefined
      if (pendingDragAzimuth === undefined || element.dataset.dragging !== 'time') return
      let nextAzimuth = pendingDragAzimuth
      pendingDragAzimuth = undefined
      updateTimeFromSunAngle(nextAzimuth)
      setDraggedSunAngle(element, nextAzimuth)
    })
  }

  function flushDraggedTimeUpdate(azimuthDeg: number) {
    if (dragFrame !== undefined) {
      cancelAnimationFrame(dragFrame)
      dragFrame = undefined
    }
    pendingDragAzimuth = undefined
    updateTimeFromSunAngle(azimuthDeg)
  }

  function cancelDraggedTimeUpdate() {
    if (dragFrame !== undefined) {
      cancelAnimationFrame(dragFrame)
      dragFrame = undefined
    }
    pendingDragAzimuth = undefined
  }
}

function finishSunAngleDrag(element: HTMLElement) {
  restoreMapGesturesAfterMarkerDrag()
  element.dataset.dragging = 'none'
  sunAngleDragAzimuth = undefined
  sunAngleDragMinute = undefined
}

function bindMarkerPositionDragHandle(handle: MarkerDragHandle, element: HTMLElement, overlay: SunMarkerOverlay) {
  let dragStartPointer: { x: number; y: number } | undefined
  let dragStartPixel: google.maps.Point | undefined
  let didMove = false
  let nextPoint: google.maps.LatLngLiteral | undefined

  handle.addEventListener('pointerdown', (event) => {
    if (!selectedPoint) return
    let projection = overlay.getProjection()
    let startPixel = projection?.fromLatLngToDivPixel(new google.maps.LatLng(selectedPoint))
    if (!startPixel) return

    suspendMapGesturesForMarkerDrag()
    suppressMapClickAfterMarkerDrag()
    event.preventDefault()
    event.stopPropagation()
    handle.setPointerCapture(event.pointerId)
    element.dataset.dragging = 'place'
    dragStartPointer = { x: event.clientX, y: event.clientY }
    dragStartPixel = startPixel
    didMove = false
    nextPoint = selectedPoint
  })

  handle.addEventListener('pointermove', (event) => {
    if (element.dataset.dragging !== 'place' || !handle.hasPointerCapture(event.pointerId)) return
    if (!dragStartPointer || !dragStartPixel) return

    suppressMapClickAfterMarkerDrag()
    event.preventDefault()
    event.stopPropagation()

    let dx = event.clientX - dragStartPointer.x
    let dy = event.clientY - dragStartPointer.y
    if (!didMove && Math.hypot(dx, dy) < 4) return
    didMove = true

    let projection = overlay.getProjection()
    let latLng = projection?.fromDivPixelToLatLng(new google.maps.Point(dragStartPixel.x + dx, dragStartPixel.y + dy))
    if (!latLng) return

    nextPoint = latLng.toJSON()
    overlay.setPosition(nextPoint)
    els.point.textContent = `${nextPoint.lat.toFixed(6)}, ${nextPoint.lng.toFixed(6)}`
  })

  handle.addEventListener('pointerup', (event) => {
    suppressMapClickAfterMarkerDrag()
    event.preventDefault()
    event.stopPropagation()
    if (handle.hasPointerCapture(event.pointerId)) handle.releasePointerCapture(event.pointerId)
    let droppedPoint = nextPoint
    let shouldSelectDroppedPoint = didMove
    finishMarkerPositionDrag(element)
    if (droppedPoint && shouldSelectDroppedPoint) void selectPoint(droppedPoint)
  })

  handle.addEventListener('pointercancel', (event) => {
    suppressMapClickAfterMarkerDrag()
    event.preventDefault()
    event.stopPropagation()
    if (handle.hasPointerCapture(event.pointerId)) handle.releasePointerCapture(event.pointerId)
    finishMarkerPositionDrag(element)
    if (selectedPoint) overlay.setPosition(selectedPoint)
  })

  handle.addEventListener('click', (event) => {
    suppressMapClickAfterMarkerDrag()
    event.preventDefault()
    event.stopPropagation()
  })

  handle.addEventListener('touchstart', preventMarkerTouchGesture, { passive: false })
  handle.addEventListener('touchmove', preventMarkerTouchGesture, { passive: false })

  function finishMarkerPositionDrag(draggedElement: HTMLElement) {
    restoreMapGesturesAfterMarkerDrag()
    draggedElement.dataset.dragging = 'none'
    dragStartPointer = undefined
    dragStartPixel = undefined
    didMove = false
    nextPoint = undefined
  }
}

function compassAngleFromPointer(event: PointerEvent, element: HTMLElement) {
  let rect = element.getBoundingClientRect()
  let x = event.clientX - (rect.left + rect.width / 2)
  let y = event.clientY - (rect.top + rect.height / 2)
  return (toDegrees(Math.atan2(x, -y)) + 360) % 360
}

function preventMarkerTouchGesture(event: TouchEvent) {
  if (!selectedProfile) return
  suppressMapClickAfterMarkerDrag()
  event.preventDefault()
  event.stopPropagation()
}

function suspendMapGesturesForMarkerDrag() {
  if (markerDragMapOptions) return
  markerDragMapOptions = {
    draggable: map.get('draggable') as boolean | undefined,
    gestureHandling: map.get('gestureHandling') as google.maps.MapOptions['gestureHandling'],
  }
  map.setOptions({ draggable: false, gestureHandling: 'none' })
}

function restoreMapGesturesAfterMarkerDrag() {
  if (!markerDragMapOptions) return
  map.setOptions({
    draggable: markerDragMapOptions.draggable ?? true,
    gestureHandling: markerDragMapOptions.gestureHandling ?? 'greedy',
  })
  markerDragMapOptions = undefined
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

    .sun-map-marker[data-dragging="time"] .sun-map-marker__day {
      cursor: grabbing;
    }

    .sun-map-marker[data-has-day="true"] .sun-map-marker__day:hover,
    .sun-map-marker[data-dragging="time"] .sun-map-marker__day {
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
      transition: opacity 160ms ease;
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
      pointer-events: none;
      position: absolute;
      top: 50%;
      transform: translate(-50%, -50%);
      transition: box-shadow 160ms ease, transform 160ms ease;
      touch-action: none;
      width: 44px;
    }

    .sun-map-marker[data-has-day="true"] .sun-map-marker__core {
      cursor: grab;
      pointer-events: auto;
    }

    .sun-map-marker[data-dragging="place"] .sun-map-marker__core {
      cursor: grabbing;
    }

    .sun-map-marker[data-has-day="true"] .sun-map-marker__core:hover,
    .sun-map-marker[data-dragging="place"] .sun-map-marker__core {
      box-shadow:
        0 0 0 4px rgba(255, 255, 255, 0.5),
        0 13px 28px var(--marker-shadow);
      transform: translate(-50%, -50%) scale(1.08);
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

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value))
}

function smoothstep(value: number) {
  let amount = clamp01(value)
  return amount * amount * (3 - 2 * amount)
}

function mixNumber(from: number, to: number, amount: number) {
  return from + (to - from) * amount
}

function mixHex(from: string, to: string, amount: number) {
  let fromRgb = hexToRgb(from)
  let toRgb = hexToRgb(to)
  return rgbToHex({
    b: Math.round(mixNumber(fromRgb.b, toRgb.b, amount)),
    g: Math.round(mixNumber(fromRgb.g, toRgb.g, amount)),
    r: Math.round(mixNumber(fromRgb.r, toRgb.r, amount)),
  })
}

function perceivedBrightness(hex: string) {
  let rgb = hexToRgb(hex)
  return Math.sqrt(0.241 * rgb.r * rgb.r + 0.691 * rgb.g * rgb.g + 0.068 * rgb.b * rgb.b)
}

function colorWarmth(hex: string) {
  let rgb = hexToRgb(hex)
  return rgb.r - rgb.b
}

function hexToRgb(hex: string): Rgb {
  let value = Number.parseInt(hex.slice(1), 16)
  return {
    b: value & 255,
    g: (value >> 8) & 255,
    r: (value >> 16) & 255,
  }
}

function rgbToHex(rgb: Rgb) {
  let value = (rgb.r << 16) + (rgb.g << 8) + rgb.b
  return `#${value.toString(16).padStart(6, '0')}`
}

function hexToRgba(hex: string, alpha: number) {
  let rgb = hexToRgb(hex)
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`
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
