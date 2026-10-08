import {clamp, radians} from './flight_math.mjs';

const formatters = new Map();
const wrap = (value, period) => ((value % period) + period) % period;
const degrees = value => value * 180 / Math.PI;

function formatter(timeZone, kind) {
  const key = `${timeZone}:${kind}`;
  if (!formatters.has(key)) {
    const options = kind === 'date'
      ? {month:'short', day:'numeric', year:'numeric'}
      : kind === 'zone' ? {timeZoneName:'shortOffset', hour:'2-digit'}
      : {hour:'2-digit', minute:'2-digit', hourCycle:'h23'};
    formatters.set(key, new Intl.DateTimeFormat('en-US', {...options, timeZone}));
  }
  return formatters.get(key);
}

export function timeZoneAt(journey, sample) {
  const index = !sample.gap && sample.fraction >= .5
    ? Math.min(sample.index + 1, journey.points.length - 1) : sample.index;
  return journey.timeZones?.[journey.points[index][7]] ?? 'UTC';
}

export function formatFlightTime(unixSeconds, timeZone) {
  const date = new Date(unixSeconds * 1000);
  const offset = formatter(timeZone, 'zone').formatToParts(date)
    .find(part => part.type === 'timeZoneName').value.replace('GMT', 'UTC');
  return {
    date:formatter(timeZone, 'date').format(date),
    time:formatter(timeZone, 'time').format(date),
    utcDate:formatter('UTC', 'date').format(date),
    utcTime:formatter('UTC', 'time').format(date),
    offset,
    timeZone
  };
}

// Solar geometry follows the NOAA/Meeus equations, without atmospheric refraction.
export function solarElevation(unixSeconds, longitude, latitude) {
  const t = (unixSeconds / 86400 + 2440587.5 - 2451545) / 36525;
  const meanLongitude = radians(wrap(280.46646 + t * (36000.76983 + t * .0003032), 360));
  const meanAnomaly = radians(357.52911 + t * (35999.05029 - .0001537 * t));
  const eccentricity = .016708634 - t * (.000042037 + .0000001267 * t);
  const equationOfCenter = Math.sin(meanAnomaly) * (1.914602 - t * (.004817 + .000014 * t))
    + Math.sin(2 * meanAnomaly) * (.019993 - .000101 * t) + Math.sin(3 * meanAnomaly) * .000289;
  const omega = radians(125.04 - 1934.136 * t);
  const apparentLongitude = meanLongitude + radians(equationOfCenter - .00569 - .00478 * Math.sin(omega));
  const meanObliquity = 23 + (26 + (21.448 - t * (46.815 + t * (.00059 - t * .001813))) / 60) / 60;
  const obliquity = radians(meanObliquity + .00256 * Math.cos(omega));
  const declination = Math.asin(Math.sin(obliquity) * Math.sin(apparentLongitude));
  const y = Math.tan(obliquity / 2) ** 2;
  const equationOfTime = 4 * degrees(y * Math.sin(2 * meanLongitude) - 2 * eccentricity * Math.sin(meanAnomaly)
    + 4 * eccentricity * y * Math.sin(meanAnomaly) * Math.cos(2 * meanLongitude)
    - .5 * y * y * Math.sin(4 * meanLongitude) - 1.25 * eccentricity * eccentricity * Math.sin(2 * meanAnomaly));
  const solarMinutes = wrap(wrap(unixSeconds, 86400) / 60 + equationOfTime + 4 * longitude, 1440);
  const hourAngle = radians(solarMinutes / 4 - 180);
  const lat = radians(latitude);
  return degrees(Math.asin(clamp(Math.sin(lat) * Math.sin(declination)
    + Math.cos(lat) * Math.cos(declination) * Math.cos(hourAngle), -1, 1)));
}

export function lightPhase(elevation) {
  if (elevation >= -.833) return {name:'Daylight', kind:'day'};
  if (elevation >= -6) return {name:'Civil twilight', kind:'twilight'};
  if (elevation >= -12) return {name:'Nautical twilight', kind:'twilight'};
  if (elevation >= -18) return {name:'Astronomical twilight', kind:'twilight'};
  return {name:'Night', kind:'night'};
}
