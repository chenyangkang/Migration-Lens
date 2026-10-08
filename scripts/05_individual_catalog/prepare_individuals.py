"""Add individually identified migrations from the existing public archives."""
from pathlib import Path
from copy import deepcopy
import argparse
import importlib.util
import json
import sys
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


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--vultures', required=True, help='Original public Movebank GPS CSV')
    parser.add_argument('--geese', required=True)
    parser.add_argument('--cranes', required=True)
    args = parser.parse_args()
    finder = TimezoneFinder(in_memory=True)
    tracks = module('tracks', 'scripts/03_data_preparation/prepare_tracks.py')
    migrations = module('migrations', 'scripts/04_multi_species/prepare_migrations.py')
    templates = json.loads((ROOT/'data/04_multi_species/journeys.json').read_text())['journeys']
    columns = ['timestamp','location-long','location-lat','height-raw','ground-speed','heading','visible','algorithm-marked-outlier','import-marked-outlier','manually-marked-outlier','individual-local-identifier','individual-taxon-canonical-name']
    vultures = pd.read_csv(args.vultures, usecols=columns, low_memory=False)
    vultures = vultures[(vultures.visible == True) & (vultures['individual-taxon-canonical-name'] == 'Cathartes aura')].copy()
    for field in ['algorithm-marked-outlier','import-marked-outlier','manually-marked-outlier']:
        vultures = vultures[vultures[field].astype(str).str.lower() != 'true']
    vultures['time'] = pd.to_datetime(vultures.timestamp, utc=True)
    steve = tracks.curate(vultures, 'Steve', pd.Timestamp('2021-09-29', tz='UTC'),
                         pd.Timestamp('2021-10-27', tz='UTC'), 'steve_2021',
                         'Turkey vulture · Arizona to Colombia', 'Across Central America',
                         'Follow Steve from Arizona through Mexico and Central America to northern Colombia. Hourly GPS observations show the broad migration, with daytime flight windows selected from the public archive.', 7200)
    steve['publicationTitle'] = 'Related research: weather and migration stopovers (earlier years)'
    steve['resolutionNote'] = 'Hourly GPS fixes · daytime flight selection'
    journeys = [annotate_time_zones(steve, finder)]
    geese = pd.read_csv(args.geese)
    geese = geese[geese.used == 1].copy()
    geese['time'] = pd.to_datetime(geese.date_time, format='%m/%d/%Y %H:%M', utc=True)
    geese = geese.rename(columns={'lon_decdeg':'lon', 'lat_decdeg':'lat', 'animal_alt_orig':'alt'})
    choices = [
        ('gwf_180937.1_118_4', 'white_fronted_goose_180937_2021', 0, 'Oregon to Alaska', 'North along the Pacific coast'),
        ('gwf_171633.1_14_4', 'white_fronted_goose_171633_2019', 0, 'Oregon to Alaska', 'Spring along the Pacific coast'),
        ('gwf_171615.1_4_4', 'white_fronted_goose_171615_2019', 0, 'Oregon to Alaska', 'Return north · spring 2019'),
        ('lsn_171625.1_55_4', 'snow_goose_171625_2019', 1, 'Gulf of Alaska to Washington', 'Across the Northeast Pacific'),
        ('lsn_193468.2_148_1', 'snow_goose_193468_2020', 1, 'Alaska to British Columbia', 'An autumn coastal crossing')
    ]
    for bout, key, template_index, title, subtitle in choices:
        frame = geese[(geese.animal_bout == bout) & geese.alt.between(-100, 6500)].copy()
        frame = frame.sort_values('time').drop_duplicates('time').reset_index(drop=True)
        metadata = deepcopy(templates[template_index])
        metadata.update(id=key, individual=str(frame.animal_id.iloc[0]), title=f'{metadata["species"]} · {title}',
                        subtitle=subtitle, curation=f'Published bout {bout}; used=1 GPS observations only; model altitude bands excluded; duplicate timestamps removed; original GPS heights outside −100 to 6500 m excluded; night observations retained.')
        journey = migrations.normalize(frame, metadata, finder)
        candidates = frame[(frame.day == 'day') & (frame.alt >= 150) & (frame.kmcoast < 25)]
        journey['previewIndex'] = int(candidates.index[0]) if len(candidates) else 0
        journeys.append(journey)
    cranes = pd.read_csv(args.cranes)
    inverse = Transformer.from_pipeline('+proj=pipeline +step +inv +proj=aeqd +lat_0=51 +lon_0=-110 +ellps=GRS80 +x_0=0 +y_0=0 +units=km +step +proj=unitconvert +xy_in=rad +xy_out=deg')
    for individual in [100843, 100854]:
        frame = cranes[cranes.Crane == individual].copy()
        frame['lon'], frame['lat'] = inverse.transform(frame.X.to_numpy(), frame.Y.to_numpy())
        frame['time'] = pd.to_datetime(frame.Time, format='%m/%d/%Y %H:%M', utc=True)
        frame['alt'] = np.nan
        metadata = deepcopy(templates[2])
        metadata.update(id=f'sandhill_crane_{individual}_2013', individual=str(individual),
                        title='Sandhill crane · Bering coast to northern Mexico', subtitle='From the Bering coast to Chihuahua',
                        description='A real autumn 2013 migration from the Bering coast to northern Mexico. Sparse GPS fixes show the broad route; flight altitude was not released.',
                        curation=f'Individual {individual}; duplicate timestamps removed, sorted by UTC. Published kilometre X/Y coordinates inverted using the exact AEQD/GRS80 projection parameters (centre 51° N, 110° W). Altitude and instantaneous speed were not released.')
        journeys.append(migrations.normalize(frame, metadata, finder))
    output = ROOT/'data/05_individual_catalog/journeys.json'
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps({'schemaVersion':2, 'journeys':journeys}, separators=(',', ':')))
    manifest = {'localTime':time_zone_provenance(), 'sourceManifests':['data_manifest.json', 'multi_species_manifest.json'],
                'tracks':[{k:j[k] for k in ['id','species','individual','curation','sourceDoi']} | {'fixes':len(j['points'])} for j in journeys]}
    (ROOT/'resources/individual_catalog_manifest.json').write_text(json.dumps(manifest, indent=2))
    for j in journeys:
        print(j['id'], j['individual'], len(j['points']), 'fixes', j['totalDistanceKm'], 'km', flush=True)


if __name__ == '__main__':
    main()
