"""Curate redistributable GPS migration selections, retaining archive identifiers."""
from pathlib import Path
from copy import deepcopy
import argparse
import hashlib
import importlib.util
import json
import re
import sys
import urllib.request
import numpy as np
import pandas as pd
from pyproj import Transformer
from timezonefinder import TimezoneFinder

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT/'scripts/01_shared_helpers'))
from local_time_metadata import annotate_time_zones, time_zone_provenance


def module(name, file):
    spec = importlib.util.spec_from_file_location(name, ROOT/file)
    result = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(result)
    return result


def slug(value):
    return re.sub(r'[^a-z0-9]+', '_', value.lower()).strip('_')


def gps_frame(path):
    fields = {'event-id', 'visible', 'timestamp', 'location-long', 'location-lat', 'sensor-type', 'individual-local-identifier', 'individual-taxon-canonical-name', 'algorithm-marked-outlier', 'import-marked-outlier', 'manually-marked-outlier', 'height-raw', 'height-above-msl', 'height-above-ellipsoid', 'ground-speed', 'heading'}
    frame = pd.read_csv(path, usecols=lambda column: column in fields, low_memory=False)
    if 'visible' in frame:
        frame = frame[frame.visible.astype(str).str.lower() == 'true']
    if 'sensor-type' in frame:
        frame = frame[frame['sensor-type'].str.upper() == 'GPS']
    for field in ['algorithm-marked-outlier', 'import-marked-outlier', 'manually-marked-outlier']:
        if field in frame:
            frame = frame[frame[field].astype(str).str.lower() != 'true']
    frame = frame.dropna(subset=['timestamp', 'location-long', 'location-lat'])
    frame['time'] = pd.to_datetime(frame.timestamp, utc=True, format='mixed')
    return frame.rename(columns={'location-long':'lon', 'location-lat':'lat'})


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--source-dir', required=True)
    parser.add_argument('--download', action='store_true')
    parser.add_argument('--vultures', required=True)
    parser.add_argument('--geese', required=True)
    parser.add_argument('--cranes', required=True)
    args = parser.parse_args()
    directory = Path(args.source_dir)
    directory.mkdir(parents=True, exist_ok=True)
    config = json.loads((ROOT/'resources/configs/diverse_migrations.json').read_text())
    normalizer = module('migrations', 'scripts/04_multi_species/prepare_migrations.py').normalize
    finder = TimezoneFinder(in_memory=True)
    journeys, files, cache = [], {}, {}
    for source in config['sources']:
        frames = []
        for file in source['files']:
            path = directory/file['file']
            if args.download and not path.exists():
                urllib.request.urlretrieve(file['url'], path)
            if path not in cache:
                cache[path] = gps_frame(path)
                files[file['file']] = file | {'sha256':hashlib.sha256(path.read_bytes()).hexdigest()}
            frames.append(cache[path])
        combined = pd.concat(frames, ignore_index=True)
        for selection in source['choices']:
            frame = combined[(combined['individual-local-identifier'].astype(str) == selection['individual']) &
                             (combined['individual-taxon-canonical-name'] == source['scientificName']) &
                             (combined.time >= selection['start']) & (combined.time < selection['end'])].copy()
            frame = frame[frame.lon.between(-180, 180) & frame.lat.between(-90, 90)]
            frame = frame.sort_values('time').drop_duplicates('time').reset_index(drop=True)
            original_count = len(frame)
            spacing = source.get('minSpacingSeconds', 0)
            if spacing:
                # Select original fixes in time buckets; never manufacture resampled positions.
                bucket = frame.time.astype('int64')//(spacing*10**9)
                frame = frame.loc[~bucket.duplicated()].reset_index(drop=True)
            height_field = next((field for field in source['heightFields'] if field in frame and frame[field].notna().any()), None)
            frame['alt'] = pd.to_numeric(frame[height_field], errors='coerce') if height_field else np.nan
            frame.loc[~frame.alt.between(-500, 10000), 'alt'] = np.nan
            height_coverage = float(frame.alt.notna().mean())
            if source.get('requireHeight'):
                frame = frame[frame.alt.notna()].reset_index(drop=True)
            elif height_coverage < .9:
                frame['alt'] = np.nan
                height_field = None
            year = frame.time.iloc[0].year
            key = f'{slug(source["species"])}_{slug(selection["individual"])}_{year}'
            height_note = ('Published GPS height in metres from '+height_field+'; the datum is '+
                          ('mean sea level.' if height_field == 'height-above-msl' else 'WGS84 ellipsoid.')+
                          ' Camera height remains approximate and may be raised above terrain.') if height_field else (
                          source.get('heightReason', 'No consistently available flight-height series is provided for this selection.')+
                          ' Viewing height is illustrative: 750 m above loaded terrain.')
            metadata = {'id':key, 'title':source['species']+' · '+selection['route'], 'subtitle':selection['subtitle'],
                        'individual':selection['individual'], 'species':source['species'], 'scientificName':source['scientificName'],
                        'description':source['description'], 'sourceDoi':source['sourceDoi'], 'studyId':source['studyId'],
                        'licence':source['licence'], 'citation':source['citation'], 'publication':source['publication'] or None,
                        'publicationTitle':source['publicationTitle'], 'flightStyle':source['flightStyle'],
                        'altitudeField':height_field, 'altitudeDatum':height_note, 'defaultCameraHeightM':750,
                        'maxInterpolationGapSeconds':source['maxGap'],
                        'gapExplanation':'No GPS fixes are present in this published selection. Tag schedules, transmission or archive filtering may create gaps; the individual cause is not recorded.',
                        'curation':f'Individual {selection["individual"]}; UTC selection [{selection["start"]}, {selection["end"]}); GPS sensor rows only; visible records only where visibility is supplied; marked outliers excluded; duplicate timestamps removed. '+
                                   (f'First real fix per {spacing}-second UTC bucket retained. ' if spacing else 'Original fix spacing retained. ')+
                                   f'{original_count} source fixes before sampling; {len(frame)} retained. Usable selected height coverage {height_coverage:.1%}; heights below −500 or above 10000 m are unavailable. '+
                                   ('All heights left unknown because the series is too incomplete or unusable. ' if not height_field else '')+
                                   ('Fixes without a usable reported height excluded for a consistent flight-height reconstruction. ' if source.get('requireHeight') else '')+
                                   'Original event IDs accompany every retained point. No migration across a long missing interval is reconstructed.'}
            journey = normalizer(frame, metadata, finder)
            journey.update(sourceLabel='Movebank archive', gapContext='published_selection',
                           pointSourceEventIds=frame['event-id'].astype('int64').astype(str).tolist(),
                           heightCoverage=height_coverage, sourceFixCount=original_count,
                           recommendedMode='overview' if journey['medianIntervalSeconds'] > 1800 or not height_field else 'first',
                           resolutionNote=f'{journey["medianIntervalSeconds"]} s median GPS spacing'+(' · sampled bursts' if spacing else '')+
                                          (' · approximate GPS height' if height_field else ' · viewing height illustrative'))
            if 'ground-speed' in frame:
                speeds = pd.to_numeric(frame['ground-speed'], errors='coerce').to_numpy()
                for point, value in zip(journey['points'], speeds):
                    point[4] = round(float(value), 2) if np.isfinite(value) and 0 <= value <= 80 else None
                journey['speedMethod'] = 'Archive ground speed in m/s where valid; otherwise a segment mean from position and elapsed time.'
            journeys.append(journey)
            print(key, len(frame), 'fixes', journey['totalDistanceKm'], 'km', flush=True)

    templates = json.loads((ROOT/'data/04_multi_species/journeys.json').read_text())['journeys']
    geese = pd.read_csv(args.geese)
    geese = geese[geese.used == 1].rename(columns={'lon_decdeg':'lon', 'lat_decdeg':'lat', 'animal_alt_orig':'alt'})
    geese['time'] = pd.to_datetime(geese.date_time, format='%m/%d/%Y %H:%M', utc=True)
    bouts = ['gwf_171626.1_10_5', 'gwf_180929.1_16_1', 'gwf_180931.1_18_1', 'gwf_180934.1_23_1', 'gwf_193426.1_136_3',
             'twf_180856.1_86_2', 'twf_182096.1_88_1', 'twf_182098.1_91_1', 'twf_182100.1_94_1', 'twf_182104.1_100_1',
             'lsn_180788.1_64_3', 'lsn_180954.1_144_1']
    for bout in bouts:
        frame = geese[(geese.animal_bout == bout) & geese.alt.between(-100, 6500)].sort_values('time').drop_duplicates('time').reset_index(drop=True)
        metadata = deepcopy(templates[1 if bout.startswith('lsn') else 0])
        individual, year = str(frame.animal_id.iloc[0]), frame.time.iloc[0].year
        metadata.update(id=f'{slug(metadata["species"])}_{slug(individual)}_{year}', individual=individual,
                        title=metadata['species']+' · Northeast Pacific migration',
                        subtitle='A Tule goose’s Pacific crossing' if bout.startswith('twf') else 'Across the Northeast Pacific',
                        curation=f'Published bout {bout}; used=1 GPS observations only; available/model altitude bands excluded; duplicate timestamps removed; original heights outside −100 to 6500 m excluded. Night observations retained.',
                        subspecies='Anser albifrons elgasi (Tule)' if bout.startswith('twf') else None)
        journey = normalizer(frame, metadata, finder)
        journey['resolutionNote'] = f'{journey["medianIntervalSeconds"]//60}-minute GPS fixes · segment speed estimated'
        journey['description'] = f'Follow a real {journey["species"].lower()} through a published Pacific migration bout. Typical retained fixes are {journey["medianIntervalSeconds"]//60} minutes apart. Daytime and nighttime observations are retained wherever present. The release covers part of the migration.'
        journeys.append(journey)

    vulture = gps_frame(Path(args.vultures))
    vulture = vulture.rename(columns={'lon':'location-long', 'lat':'location-lat'})
    curate = module('vulture_tracks', 'scripts/03_data_preparation/prepare_tracks.py').curate
    for individual, year, start, end, route in [
        ('Reggaeton', 2021, '10-03', '11-01', 'Arizona to Panama'), ('Thomas', 2021, '10-03', '10-14', 'Arizona to western Mexico'),
        ('Harriet', 2013, '09-15', '12-01', 'Canada to northern South America'),
        ('Ozzie', 2013, '09-15', '11-15', 'Canada to Colombia')]:
        journey = curate(vulture, individual, f'{year}-{start}', f'{year}-{end}', f'{slug(individual)}_{year}',
                         'Turkey vulture · '+route, 'A continental soaring migration',
                         f'Follow {individual} through a real autumn migration selection. Hourly GPS fixes and daytime active-flight windows show the broad route.', 7200)
        journey.update(publicationTitle='Weather and migration stopovers (2006–2019 study period)',
                       resolutionNote='Hourly GPS fixes · daytime flight selection')
        journeys.append(annotate_time_zones(journey, finder))

    cranes = pd.read_csv(args.cranes)
    inverse = Transformer.from_pipeline('+proj=pipeline +step +inv +proj=aeqd +lat_0=51 +lon_0=-110 +ellps=GRS80 +x_0=0 +y_0=0 +units=km +step +proj=unitconvert +xy_in=rad +xy_out=deg')
    for individual in [100840, 100853]:
        frame = cranes[cranes.Crane == individual].copy()
        frame['lon'], frame['lat'] = inverse.transform(frame.X.to_numpy(), frame.Y.to_numpy())
        frame['time'] = pd.to_datetime(frame.Time, format='%m/%d/%Y %H:%M', utc=True)
        frame = frame.sort_values('time')
        # The public archive starts in Russia; display the subsequent Alaska-to-Texas leg.
        frame = frame[frame.time >= frame[frame.lon < 0].time.min()]
        frame['alt'] = np.nan
        metadata = deepcopy(templates[2])
        metadata.update(id=f'sandhill_crane_{individual}_2013', individual=str(individual),
                        title='Sandhill crane · Alaska to Texas', subtitle='From the Bering coast to Texas',
                        description='The Alaska-to-Texas leg of a real autumn GPS migration; the earlier Russia leg is outside this selection. Sparse fixes show the broad route. Altitude was not released.',
                        curation=f'Individual {individual}; Alaska-to-Texas leg from the first western-hemisphere fix; earlier Russia locations excluded; duplicate timestamps removed. Exact published AEQD/GRS80 coordinates inverted. No altitude or instantaneous speed supplied.')
        journeys.append(normalizer(frame, metadata, finder))

    output = ROOT/'data/08_diverse_migrations/journeys.json'
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps({'schemaVersion':2, 'journeys':journeys}, separators=(',', ':'), allow_nan=False))
    manifest = {'accessDate':'2026-10-08', 'localTime':time_zone_provenance(), 'sources':list(files.values()),
                'existingSourceManifests':['data_manifest.json', 'multi_species_manifest.json'],
                'tracks':[{key:j[key] for key in ['id', 'individual', 'species', 'sourceDoi', 'licence', 'citation', 'curation', 'altitudeDatum']} |
                          {'fixes':len(j['points']), 'firstUtc':j['points'][0][0], 'lastUtc':j['points'][-1][0]} for j in journeys]}
    (ROOT/'resources/diversity_manifest.json').write_text(json.dumps(manifest, indent=2, ensure_ascii=False))
    print('Added', len(journeys), 'real migration selections', flush=True)


if __name__ == '__main__':
    main()
