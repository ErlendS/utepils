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

let map: google.maps.Map
let marker: google.maps.Marker | undefined
let selectedProfile: HorizonResponse | undefined
let selectedPoint: google.maps.LatLngLiteral | undefined

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
  windows: document.querySelector<HTMLElement>('#sun-windows')!,
}

bootstrap().catch((error) => {
  showToast(error instanceof Error ? error.message : 'Unable to start the app.')
})

async function bootstrap() {
  setSliderToNow()
  els.slider.addEventListener('input', () => updateForCurrentTime())

  let config = await fetchJson<ConfigResponse>('/api/config')
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

  showToast('Click the map to choose a sun/shade spot.')
  updateForCurrentTime()
}

async function selectPoint(point: google.maps.LatLngLiteral) {
  selectedPoint = point
  selectedProfile = undefined
  setMarker(point, 'loading')
  setLoading(point)

  try {
    let profile = await fetchJson<HorizonResponse>(
      `/api/poi-profile?lat=${encodeURIComponent(point.lat)}&lng=${encodeURIComponent(point.lng)}`,
    )
    selectedProfile = profile
    selectedPoint = { lat: profile.lat, lng: profile.lng }
    els.dsm.textContent = profile.dsm
      ? `${profile.dsm.imageryQuality ?? 'DSM'} at ${profile.dsm.pixelSizeXMeters.toFixed(2)}m px`
      : 'DSM loaded'
    updateSunWindows()
    updateForCurrentTime()
    showToast('Profile ready. Scrub the time slider.')
  } catch (error) {
    setMarker(point, 'error')
    setStatus('Profile failed', error instanceof Error ? error.message : 'Profile request failed.', 'error')
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
  showToast('Fetching DSM and building horizon profile...')
}

function setStatus(label: string, detail: string, mode: 'error' | 'loading' | 'shade' | 'sun') {
  els.label.textContent = label
  els.detail.textContent = detail
  let color = mode === 'sun' ? '#f5b93f' : mode === 'shade' ? '#53616f' : mode === 'error' ? '#c94b4b' : '#56a0c8'
  els.dot.style.background = color
  els.dot.style.boxShadow = `0 0 0 6px ${hexToRgba(color, 0.16)}`
}

function setMarker(point: google.maps.LatLngLiteral, mode: 'error' | 'loading' | 'shade' | 'sun') {
  let color = mode === 'sun' ? '#f5b93f' : mode === 'shade' ? '#53616f' : mode === 'error' ? '#c94b4b' : '#56a0c8'
  let label = mode === 'sun' ? 'SUN' : mode === 'shade' ? 'SHADE' : mode === 'error' ? 'ERR' : '...'

  if (!marker) {
    marker = new google.maps.Marker({ map, position: point })
  }

  marker.setPosition(point)
  marker.setLabel({ color: '#ffffff', fontSize: '11px', fontWeight: '800', text: label })
  marker.setIcon({
    fillColor: color,
    fillOpacity: 1,
    path: google.maps.SymbolPath.CIRCLE,
    scale: 22,
    strokeColor: '#ffffff',
    strokeWeight: 3,
  })
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
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
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

async function fetchJson<T>(url: string): Promise<T> {
  let response = await fetch(url)
  let body = await response.json().catch(() => undefined)
  if (!response.ok) {
    let message =
      body && typeof body === 'object' && 'error' in body
        ? String((body as { error: unknown }).error)
        : `Request failed with ${response.status}`
    throw new Error(message)
  }
  return body as T
}

function showToast(message: string) {
  els.toast.textContent = message
  els.toast.style.opacity = '1'
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
