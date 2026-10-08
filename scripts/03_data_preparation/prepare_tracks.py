"""Curate real Movebank archive observations for the flight viewer."""
from pathlib import Path
import argparse
import hashlib
import json
import sys
import numpy as np
import pandas as pd
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / '01_shared_helpers'))
from local_time_metadata import annotate_time_zones, time_zone_provenance

ROOT = Path(__file__).resolve().parents[2]
DOI = 'https://doi.org/10.5441/001/1.f3qt46r2'


def distances(lon, lat):
    lon, lat = np.radians(lon), np.radians(lat)
    a = np.sin(np.diff(lat) / 2) ** 2 + np.cos(lat[:-1]) * np.cos(lat[1:]) * np.sin(np.diff(lon) / 2) ** 2
    return 6371008.8 * 2 * np.arctan2(np.sqrt(a), np.sqrt(np.maximum(0, 1-a)))


def curate(df, name, start, end, key, title, subtitle, description, max_gap):
    g = df[(df['individual-local-identifier'] == name) & (df['time'] >= start) & (df['time'] < end)].copy().sort_values('time')
    g = g.drop_duplicates('time').dropna(subset=['location-long', 'location-lat'])
    g['alt'] = pd.to_numeric(g['height-raw'], errors='coerce')
    g = g[(g['alt'] >= -100) & (g['alt'] <= 6500)].copy()
    # Trim UTC−7 selection windows to active observations while retaining pauses.
    g['day'] = (g['time'] - pd.Timedelta(hours=7)).dt.strftime('%Y-%m-%d')
    pieces = []
    for date, day in g.groupby('day'):
        moving = day[day['ground-speed'] >= 4]
        if len(moving) < 3:
            continue
        pieces.append(day[(day['time'] >= moving['time'].min()) & (day['time'] <= moving['time'].max())])
    g = pd.concat(pieces).reset_index(drop=True)
    sec = g['time'].astype('int64').to_numpy() // 10**9
    lon = g['location-long'].to_numpy()
    lat = g['location-lat'].to_numpy()
    step = distances(lon, lat)
    dt = np.diff(sec)
    # Drop isolated observations requiring implausible inter-fix travel speeds.
    bad = np.r_[False, (dt > 0) & (step / np.maximum(dt, 1) > 40)]
    if bad.any():
        g = g[~bad].reset_index(drop=True)
        sec = g['time'].astype('int64').to_numpy() // 10**9
        lon, lat = g['location-long'].to_numpy(), g['location-lat'].to_numpy()
        step, dt = distances(lon, lat), np.diff(sec)
    cum = np.r_[0, np.cumsum(step)] / 1000
    points = []
    for i, row in g.iterrows():
        speed = row['ground-speed']
        heading = row['heading']
        points.append([int(sec[i]), round(float(lon[i]), 5), round(float(lat[i]), 5), round(float(row['alt']), 1), None if pd.isna(speed) else round(float(speed), 3), None if pd.isna(heading) else round(float(heading), 1), round(float(cum[i]), 3)])
    days = []
    for date, day in g.groupby('day', sort=True):
        first, last = int(day.index[0]), int(day.index[-1])
        days.append({'date':date,'startIndex':first,'endIndex':last,'distanceKm':round(float(cum[last]-cum[first]),1),'fixes':len(day)})
    typical = float(np.median(dt[dt>0]))
    candidate = g[(g['ground-speed'] >= 8) & (g['alt'] >= 750)]
    preview = int(candidate.index[0]) if len(candidate) else min(1,len(g)-1)
    return {'id':key,'title':title,'subtitle':subtitle,'description':description,'individual':name,'species':'Turkey vulture','scientificName':'Cathartes aura','sourceDoi':DOI,'studyId':'481458','licence':'CC BY 4.0 (repository metadata)','citation':'Bildstein KL, Barber D, Bechard MJ, Graña Grilli M, Therrien J. 2021. Data from: Study “Vultures Acopian Center USA GPS” (2003–2021). Movebank Data Repository.','publication':'https://doi.org/10.1186/s40462-021-00274-6','altitudeField':'height-raw','altitudeDatum':'Not specified in the archive; numeric GPS height treated as metres for display. Camera altitude is approximate and may be raised above terrain.','curation':'Visible Turkey Vulture GPS observations only; marked outliers removed; duplicate timestamps removed; numeric raw heights outside -100 to 6500 removed; local days trimmed to first and last fixes with ground speed ≥4 m/s; isolated inter-fix speeds >40 m/s removed.','maxInterpolationGapSeconds':max_gap,'medianIntervalSeconds':round(typical),'durationDays':round((sec[-1]-sec[0])/86400,1),'totalDistanceKm':round(float(cum[-1]),1),'distanceDefinition':'Sum of straight great-circle distances between retained observations, including gaps; an observed-path approximation, not exact flight distance.','previewIndex':preview,'points':points,'days':days,'columns':['time_unix_s','longitude','latitude','gps_height_raw_m','ground_speed_m_s','heading_degrees','cumulative_distance_km']}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('source', help='CSV downloaded from the public Movebank archive')
    args = parser.parse_args()
    cols = ['timestamp','location-long','location-lat','height-raw','ground-speed','heading','visible','algorithm-marked-outlier','import-marked-outlier','manually-marked-outlier','individual-local-identifier','individual-taxon-canonical-name']
    df = pd.read_csv(args.source, usecols=cols, low_memory=False)
    df = df[(df['visible']==True)&(df['individual-taxon-canonical-name']=='Cathartes aura')].copy()
    for col in ['algorithm-marked-outlier','import-marked-outlier','manually-marked-outlier']:
        df = df[df[col].astype(str).str.lower()!='true']
    df['time'] = pd.to_datetime(df['timestamp'], utc=True)
    journeys = [
        curate(df,'Peter','2021-09-03T07:00:00Z','2021-09-22T07:00:00Z','peter_2021','Peter · Arizona to Mexico','Sonoran Desert to the Pacific lowlands','Follow Peter south through Arizona, Sonora and Sinaloa during September 2021. Many locations were recorded around once a minute.',600),
        curate(df,'Leo','2016-09-24T00:00:00Z','2016-11-02T00:00:00Z','leo_2016','Leo · Canada to Nicaragua','A continental migration','Follow Leo from Saskatchewan across the United States and Central America to Nicaragua. Hourly fixes reveal the broad journey; fine flight manoeuvres are not recorded.',7200)
    ]
    out = ROOT/'data/03_data_preparation/journeys.json'
    for journey in journeys:
        annotate_time_zones(journey)
    out.write_text(json.dumps({'schemaVersion':2,'journeys':journeys}, separators=(',',':')), encoding='utf-8')
    manifest = {'sourceUrl':'https://datarepository.movebank.org/server/api/core/bitstreams/b5c678b9-dca2-4710-a41d-a6f76af96ba6/content','sourceDoi':DOI,'sourceSha256':hashlib.sha256(Path(args.source).read_bytes()).hexdigest(),'accessDate':'2026-10-08','sourceRows':1772639,'licenceNote':'Repository metadata states CC BY 4.0; bundled README states CC0. Migration Lens preserves full attribution and follows the more restrictive CC BY attribution condition.','tracks':[{k:j[k] for k in ['id','individual','medianIntervalSeconds','totalDistanceKm','durationDays','curation']}|{'fixes':len(j['points']),'days':len(j['days'])} for j in journeys]}
    manifest['localTime'] = time_zone_provenance()
    for entry, journey in zip(manifest['tracks'], journeys):
        entry['timeZones'] = journey['timeZones']
    (ROOT/'resources/data_manifest.json').write_text(json.dumps(manifest,indent=2))
    for j in journeys: print(j['id'],len(j['points']),'fixes',len(j['days']),'days',j['totalDistanceKm'],'km',j['medianIntervalSeconds'],'sec interval','preview',j['points'][j['previewIndex']])

if __name__=='__main__': main()
