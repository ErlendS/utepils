export function getSunPosition(date: Date, lat: number, lng: number) {
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
  let siderealTime = rad * (280.16 + 360.9856235 * daysSinceJ2000) + lng * rad
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
