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
  setMode(mode: MarkerMode): void
  setPosition(point: google.maps.LatLngLiteral): void
}

let map: google.maps.Map
let marker: SunMarkerOverlay | undefined
let selectedProfile: HorizonResponse | undefined
let selectedPoint: google.maps.LatLngLiteral | undefined
let selectPointController: AbortController | undefined

const els = {
  dot: document.querySelector<HTMLElement>('#status-dot')!,
  dsm: document.querySelector<HTMLElement>('#dsm-readout')!,
  label: document.querySelector<HTMLElement>('#status-label')!,
  detail: document.querySelector<HTMLElement>('#status-detail')!,
  map: document.querySelector<HTMLElement>('#map')!,
  point: document.querySelector<HTMLElement>('#point-readout')!,
  slider: document.querySelector<HTMLInputElement>('#time-slider')!,
  time: document.querySelector<HTMLElement>('#time-output')!,
  toast: document.querySelector<HTMLElement>('#map-toast')!,
  useLocation: document.querySelector<HTMLButtonElement>('#use-location-button')!,
  windows: document.querySelector<HTMLElement>('#sun-windows')!,
}

bootstrap().catch((error) => {
  showErrorToast(error instanceof Error ? error.message : 'Unable to start the app.')
})

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
    mapTypeId: google.maps.MapTypeId.ROADMAP,
    streetViewControl: false,
    zoom: 15,
  })

  map.addListener('click', (event: google.maps.MapMouseEvent) => {
    if (!event.latLng) return
    void selectPoint(event.latLng.toJSON())
  })
  els.useLocation.addEventListener('click', () => {
    void useCurrentLocation()
  })

  updateForCurrentTime()
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
  setMarker(point, 'loading')
  setLoading(point)

  try {
    let profile = await fetchJson<HorizonResponse>(
      `/api/poi-profile?lat=${encodeURIComponent(point.lat)}&lng=${encodeURIComponent(point.lng)}`,
      signal,
    )
    selectedProfile = profile
    selectedPoint = { lat: profile.lat, lng: profile.lng }
    els.dsm.textContent = profile.dsm
      ? `${profile.dsm.imageryQuality ?? 'DSM'} at ${profile.dsm.pixelSizeXMeters.toFixed(2)}m px`
      : 'DSM loaded'
    updateSunWindows()
    updateForCurrentTime()
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') return
    setMarker(point, 'error')
    let message = error instanceof Error ? error.message : 'Profile request failed.'
    setStatus('Profile failed', message, 'error')
    showErrorToast(message)
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

  let windows: Array<{ end: number; start: number }> = []
  let current: { end: number; start: number } | undefined

  for (let minute = 0; minute < 1440; minute += 2) {
    let inSun = readSun(selectedProfile, dateForMinutes(minute)).inSun
    if (inSun && !current) current = { start: minute, end: minute + 2 }
    if (inSun && current) current.end = minute + 2
    if (!inSun && current) {
      windows.push(current)
      current = undefined
    }
  }
  if (current) windows.push(current)

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

  let label = element.querySelector<HTMLElement>('.sun-map-marker__label')!

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

    setPosition(nextPoint: google.maps.LatLngLiteral) {
      position = nextPoint
      this.draw()
    }
  }

  let overlay = new MarkerOverlay() as SunMarkerOverlay
  overlay.setMode(mode)
  return overlay
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
      --marker-color: #56a0c8;
      --marker-shadow: rgba(86, 160, 200, 0.28);
      height: 96px;
      left: 0;
      pointer-events: none;
      position: absolute;
      top: 0;
      transform: translate(-50%, -50%);
      width: 112px;
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
      border: 3px solid #ffffff;
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
      font-size: 11px;
      font-weight: 800;
      line-height: 1;
    }

    .sun-map-marker__rays,
    .sun-map-marker__cloud {
      opacity: 0;
      position: absolute;
    }

    .sun-map-marker[data-mode="loading"] .sun-map-marker__core::before {
      background: #ffffff;
      border-radius: 999px;
      box-shadow: 0 -10px 0 -3px #ffffff, 0 10px 0 -3px #ffffff, 10px 0 0 -3px #ffffff, -10px 0 0 -3px #ffffff;
      content: "";
      height: 16px;
      width: 16px;
    }

    .sun-map-marker[data-mode="loading"] .sun-map-marker__core {
      animation: sun-marker-bob 980ms ease-in-out infinite;
      background: #f5b93f;
      box-shadow: 0 12px 28px rgba(245, 185, 63, 0.32);
    }

    .sun-map-marker[data-mode="loading"] .sun-map-marker__rays {
      animation: sun-marker-turn 3.2s linear infinite;
      height: 78px;
      left: 17px;
      opacity: 1;
      top: 9px;
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
      left: 10px;
      top: 27px;
      transform: scale(var(--cloud-scale));
    }

    .sun-map-marker__cloud--two {
      --cloud-pop-scale: 0.9;
      --cloud-scale: 0.72;
      right: 7px;
      top: 30px;
      transform: scale(var(--cloud-scale));
    }

    .sun-map-marker__cloud--three {
      --cloud-pop-scale: 0.82;
      --cloud-scale: 0.64;
      bottom: 18px;
      left: 37px;
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

function loadGoogleMaps(apiKey: string) {
  return new Promise<void>((resolve, reject) => {
    window.__initSunMap = () => resolve()
    let script = document.createElement('script')
    script.async = true
    script.defer = true
    script.onerror = () => reject(new Error('Google Maps JavaScript failed to load.'))
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
    throw new Error(message)
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
