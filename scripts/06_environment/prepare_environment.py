"""Package hourly ERA5 surface weather along the public migration corridors."""
from pathlib import Path
from datetime import datetime, timezone
import argparse
import hashlib
import json
import math
import time
import urllib.parse
import urllib.request

ROOT = Path(__file__).resolve().parents[2]
API = 'https://archive-api.open-meteo.com/v1/archive'
VARIABLES = ['temperature_2m', 'precipitation', 'wind_speed_10m', 'wind_direction_10m']


def spherical_location(a, b, fraction):
    def vector(p):
        lon, lat = math.radians(p[1]), math.radians(p[2])
        return [math.cos(lat)*math.cos(lon), math.cos(lat)*math.sin(lon), math.sin(lat)]
    av, bv = vector(a), vector(b)
    angle = math.acos(max(-1, min(1, sum(x*y for x,y in zip(av,bv)))))
    wa = 1-fraction if angle < 1e-6 else math.sin((1-fraction)*angle)/math.sin(angle)
    wb = fraction if angle < 1e-6 else math.sin(fraction*angle)/math.sin(angle)
    v = [wa*x+wb*y for x,y in zip(av,bv)]
    return math.degrees(math.atan2(v[1],v[0])), math.degrees(math.atan2(v[2],math.hypot(v[0],v[1])))


def corridor_nodes(journey):
    nodes = set()
    for index, point in enumerate(journey['points']):
        locations = [(point[1], point[2])]
        if index:
            previous = journey['points'][index-1]
            if point[0]-previous[0] <= journey['maxInterpolationGapSeconds']:
                count = max(1, math.ceil(max(abs(point[1]-previous[1]), abs(point[2]-previous[2]))/.1))
                locations += [spherical_location(previous,point,k/count) for k in range(1,count)]
        for lon, lat in locations:
            x, y = math.floor(lon), math.floor(lat)
            nodes.update((a, b) for a in [x, x+1] for b in [y, y+1])
    return sorted(nodes)


def request_batch(nodes, first, last, cache):
    params = {'latitude':','.join(str(p[1]) for p in nodes), 'longitude':','.join(str(p[0]) for p in nodes),
              'start_date':first, 'end_date':last, 'hourly':','.join(VARIABLES), 'models':'era5',
              'wind_speed_unit':'ms', 'temperature_unit':'celsius', 'precipitation_unit':'mm',
              'timeformat':'unixtime', 'timezone':'GMT', 'cell_selection':'nearest', 'elevation':','.join('nan' for _ in nodes)}
    url = API+'?'+urllib.parse.urlencode(params)
    target = cache/(hashlib.sha256(url.encode()).hexdigest()+'.json')
    if target.exists():
        result = json.loads(target.read_text())
    else:
        for attempt in range(5):
            try:
                with urllib.request.urlopen(url, timeout=90) as response:
                    result = json.load(response)
                target.write_text(json.dumps(result, separators=(',', ':')))
                break
            except Exception as error:
                if attempt == 4:
                    raise
                print('Retry', attempt+1, str(error), flush=True)
                time.sleep(min(45, 15*(attempt+1)))
        time.sleep(.3)
    results = result if isinstance(result, list) else [result]
    if len(results) != len(nodes):
        raise ValueError('Weather response does not match requested locations')
    return results, url


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--cache', default='/private/tmp/migration_lens_weather_cache')
    args = parser.parse_args()
    cache = Path(args.cache)
    cache.mkdir(parents=True, exist_ok=True)
    config = json.loads((ROOT/'resources/configs/journey_catalog.json').read_text())
    journeys = [j for file in config['datasets'] for j in json.loads((ROOT/file).read_text())['journeys']]
    output = ROOT/'data/06_environment'
    output.mkdir(parents=True, exist_ok=True)
    manifest = {'source':'Open-Meteo Historical Weather API · ECMWF/Copernicus ERA5', 'documentation':'https://open-meteo.com/en/docs/historical-weather-api',
                'licence':'CC BY 4.0', 'retrievedAt':datetime.now(timezone.utc).isoformat(),
                'model':'ERA5', 'nativeGridDegrees':.25, 'displaySamplingDegrees':1,
                'variables':VARIABLES, 'interpretation':'Near-surface model estimates: temperature at 2 m and wind at 10 m above ground. Precipitation is the preceding-hour rain/snow water-equivalent total. Not measurements at bird flight altitude.',
                'selection':'1° nodes bordering retained fixes and short, interpolated segments; no complete continental field. Nearest grid cell, including ocean; elevation downscaling disabled.', 'journeys':[]}
    old_manifest = json.loads((ROOT/'resources/environment_manifest.json').read_text()) if (ROOT/'resources/environment_manifest.json').exists() else {'journeys':[]}
    for journey in journeys:
        target = output/(journey['id']+'.json')
        nodes = corridor_nodes(journey)
        first = datetime.fromtimestamp(journey['points'][0][0], timezone.utc).strftime('%Y-%m-%d')
        last = datetime.fromtimestamp(journey['points'][-1][0], timezone.utc).strftime('%Y-%m-%d')
        weather = {'schemaVersion':1, 'journey':journey['id'], 'stepSeconds':3600, 'spacingDegrees':1,
                   'columns':['temperature_2m_c','precipitation_previous_hour_mm','eastward_wind_10m_m_s','northward_wind_10m_m_s'], 'nodes':[]}
        urls = []
        if target.exists():
            weather = json.loads(target.read_text())
            existing = {(n['lon'],n['lat']) for n in weather['nodes']}
            nodes = [n for n in nodes if n not in existing]
            urls = next((entry['requestUrls'] for entry in old_manifest['journeys'] if entry['id']==journey['id']), [])
        for start in range(0, len(nodes), 10):
            batch = nodes[start:start+10]
            results, url = request_batch(batch, first, last, cache)
            urls.append(url)
            for (lon, lat), result in zip(batch, results):
                hourly = result['hourly']
                timestamps = hourly['time']
                if any(b-a != 3600 for a,b in zip(timestamps,timestamps[1:])):
                    raise ValueError('Expected a regular hourly UTC weather series')
                if 'startTime' in weather and weather['startTime'] != timestamps[0]:
                    raise ValueError('Weather nodes have different time origins')
                weather['startTime'] = timestamps[0]
                weather['endTime'] = timestamps[-1]
                values = []
                for temp, rain, speed, direction in zip(*(hourly[v] for v in VARIABLES)):
                    u = -speed*math.sin(math.radians(direction)) if speed is not None and direction is not None else None
                    v = -speed*math.cos(math.radians(direction)) if speed is not None and direction is not None else None
                    values.append([None if temp is None else round(temp,1), None if rain is None else round(rain,2),
                                   None if u is None else round(u,2), None if v is None else round(v,2)])
                weather['nodes'].append({'lon':lon, 'lat':lat, 'sourceLon':result['longitude'], 'sourceLat':result['latitude'], 'values':values})
            print(journey['id'], min(start+10,len(nodes)), '/', len(nodes), 'weather nodes', flush=True)
        target.write_text(json.dumps(weather, separators=(',', ':')))
        manifest['journeys'].append({'id':journey['id'], 'file':str(target.relative_to(ROOT)), 'nodes':len(weather['nodes']), 'hours':len(weather['nodes'][0]['values']),
                                     'sha256':hashlib.sha256(target.read_bytes()).hexdigest(), 'requestUrls':urls})
        print('Saved', target.name, target.stat().st_size, 'bytes', flush=True)
    (ROOT/'resources/environment_manifest.json').write_text(json.dumps(manifest, indent=2))


if __name__ == '__main__':
    main()
