"""Attach civil time zones to retained GPS fixes without changing observations."""
from datetime import datetime, timezone
from zoneinfo import ZoneInfo
from timezonefinder import TimezoneFinder


def time_zone_provenance():
    return {
        'boundaryLibrary':'timezonefinder 8.2.2, full timezones-with-oceans dataset',
        'boundarySource':'https://github.com/evansiroky/timezone-boundary-builder',
        'rules':'IANA timezone database; browser Intl.DateTimeFormat for historical offsets and DST',
        'positionMethod':'Nearest retained GPS fix; no location API requests.',
        'flightDays':'Civil dates at each recorded fix; original UTC−7 curation windows retain the same observations.'
    }


def annotate_time_zones(journey, finder=None):
    finder = finder or TimezoneFinder(in_memory=True)
    # Reduced 'same-since-now' boundaries cannot resolve historical local time.
    if finder.timezone_at(lng=-106.75, lat=23.97) != 'America/Mazatlan':
        raise ValueError('A full timezone boundary dataset is required; use timezonefinder==8.2.2.')
    zones = []
    for point in journey['points']:
        zone = finder.timezone_at(lng=point[1], lat=point[2])
        if zone is None:
            raise ValueError(f'No timezone for {point[1:3]}')
        if zone not in zones:
            zones.append(zone)
        point[:] = point[:7] + [zones.index(zone)]
    journey['timeZones'] = zones
    journey['columns'] = journey['columns'][:7] + ['time_zone_index']
    journey['localTimeMethod'] = 'Full geographic IANA timezone boundaries at recorded fixes; historical offsets and DST from IANA rules. Between fixes, the nearest observation supplies the zone. Boundaries are modern, not reconstructed historical borders.'
    # Group the existing observations by their civil date; retain every GPS fix.
    days = []
    for index, point in enumerate(journey['points']):
        zone = zones[point[7]]
        date = datetime.fromtimestamp(point[0], timezone.utc).astimezone(ZoneInfo(zone)).date().isoformat()
        if not days or days[-1]['date'] != date:
            days.append({'date':date, 'startIndex':index, 'endIndex':index, 'distanceKm':0, 'fixes':0})
        day = days[-1]
        day['endIndex'] = index
        day['fixes'] += 1
        day['distanceKm'] = round(point[6] - journey['points'][day['startIndex']][6], 1)
    journey['days'] = days
    journey['curation'] = journey['curation'].replace('local days trimmed', 'UTC−7 selection windows trimmed')
    return journey
