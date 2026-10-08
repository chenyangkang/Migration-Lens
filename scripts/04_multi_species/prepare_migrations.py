"""Normalize public USGS goose and crane migrations for the shared viewer."""
from pathlib import Path
import argparse
import hashlib
import json
import sys
import numpy as np
import pandas as pd
from pyproj import Transformer
from timezonefinder import TimezoneFinder

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / '01_shared_helpers'))
from local_time_metadata import annotate_time_zones, time_zone_provenance

ROOT = Path(__file__).resolve().parents[2]
GOOSE_DOI = 'https://doi.org/10.5066/P9VUN0Q9'
CRANE_DOI = 'https://doi.org/10.5066/F7F76BGR'
GOOSE_CITATION = 'Weiser EL, Overton CT, Douglas DC, Casazza ML, Flint PL. 2024. Movement Data for Migrating Geese Over the Northeast Pacific Ocean, 2018–2021. U.S. Geological Survey data release.'
CRANE_CITATION = 'Pearse AT, Brandt DA, Krapu GL, Hooten MB, Scharf HR. 2017. Sandhill crane locations, autumn 2013 migration. U.S. Geological Survey data release.'


def normalize(frame, metadata, finder):
    frame = frame.sort_values('time').drop_duplicates('time').reset_index(drop=True)
    lon, lat = np.radians(frame.lon.to_numpy()), np.radians(frame.lat.to_numpy())
    h = np.sin(np.diff(lat)/2)**2 + np.cos(lat[:-1])*np.cos(lat[1:])*np.sin(np.diff(lon)/2)**2
    distances = 6371008.8*2*np.arctan2(np.sqrt(h), np.sqrt(np.maximum(0,1-h)))
    cumulative = np.r_[0, np.cumsum(distances)]/1000
    seconds = frame.time.astype('int64').to_numpy()//10**9
    points = []
    for index, row in frame.iterrows():
        points.append([int(seconds[index]),round(float(row.lon),5),round(float(row.lat),5),
                       None if pd.isna(row.alt) else round(float(row.alt),1),None,None,round(float(cumulative[index]),3)])
    metadata.update(points=points, days=[], previewIndex=0, medianIntervalSeconds=int(np.median(np.diff(seconds))),
                    durationDays=round((seconds[-1]-seconds[0])/86400,1), totalDistanceKm=round(float(cumulative[-1]),1),
                    columns=['time_unix_s','longitude','latitude','gps_height_raw_m','ground_speed_m_s','heading_degrees','cumulative_distance_km'],
                    distanceDefinition='Sum of straight great-circle distances between published observations, including gaps; an observed-path approximation.',
                    speedMethod='Segment mean derived from position and elapsed time; instantaneous ground speed is not included in this release.',
                    sourceLabel='USGS archive', trackingType='GPS', gapContext='published_selection')
    annotate_time_zones(metadata,finder)
    return metadata


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--geese',required=True)
    parser.add_argument('--cranes',required=True)
    args = parser.parse_args()
    finder = TimezoneFinder(in_memory=True)
    geese = pd.read_csv(args.geese)
    # Available altitude bands are model alternatives, not extra GPS observations.
    geese = geese[geese.used == 1].copy()
    geese['time'] = pd.to_datetime(geese.date_time, format='%m/%d/%Y %H:%M', utc=True)
    geese = geese.rename(columns={'lon_decdeg':'lon','lat_decdeg':'lat','animal_alt_orig':'alt'})
    journeys = []
    choices = [
        ('gwf_171615.1_113_10','white_fronted_goose_2021','Greater white-fronted goose','Anser albifrons',
         'California coast to Alaska','North along the Pacific coast'),
        ('lsn_180789.1_71_7','snow_goose_2019','Snow goose','Anser caerulescens',
         'Gulf of Alaska to Washington','An ocean crossing, day and night')
    ]
    for bout, key, species, scientific, title, subtitle in choices:
        frame = geese[(geese.animal_bout == bout) & geese.alt.between(-100,6500)].copy()
        frame = frame.sort_values('time').drop_duplicates('time').reset_index(drop=True)
        metadata = {'id':key,'title':f'{species} · {title}','subtitle':subtitle,'individual':str(frame.animal_id.iloc[0]),
                    'species':species,'scientificName':scientific,'flightStyle':'MIGRATORY WATERFOWL',
                    'description':f'Follow a real {species.lower()} through a published Pacific migration bout. Typical fixes are 15 minutes apart, including nighttime observations. The release covers part of the migration.',
                    'sourceDoi':GOOSE_DOI,'studyId':'USGS P9VUN0Q9','licence':'U.S. public-domain data; USGS requests citation.',
                    'citation':GOOSE_CITATION,'publication':'https://doi.org/10.1111/1365-2664.14612',
                    'publicationTitle':'Related research: goose flight altitude over the Pacific',
                    'altitudeField':'animal_alt_orig','altitudeDatum':'Original GPS altitude in metres, as supplied by the release. Camera height remains approximate; adjusted analysis altitudes are not substituted.',
                    'curation':f'Published bout {bout}; used=1 observations only; available/model altitude bands excluded; duplicate timestamps removed; raw GPS altitudes outside −100 to 6500 m excluded; daytime and nighttime fixes retained.',
                    'maxInterpolationGapSeconds':2700,'gapExplanation':'No fixes are available in this published selection. Tag schedules and analysis filtering can create gaps; the cause is not specified.',
                    'resolutionNote':'15-minute GPS fixes · segment speed estimated','recommendedMode':'first'}
        journey = normalize(frame,metadata,finder)
        candidates = frame.reset_index(drop=True)
        candidates = candidates[(candidates.day=='day') & (candidates.alt>=150) & (candidates.kmcoast<25)]
        journey['previewIndex'] = int(candidates.index[0]) if len(candidates) else 0
        journeys.append(journey)
    crane = pd.read_csv(args.cranes)
    crane = crane[crane.Crane==100845].copy()
    # Invert the published GRS80 azimuthal equidistant projection, in kilometres.
    inverse = Transformer.from_pipeline('+proj=pipeline +step +inv +proj=aeqd +lat_0=51 +lon_0=-110 +ellps=GRS80 +x_0=0 +y_0=0 +units=km +step +proj=unitconvert +xy_in=rad +xy_out=deg')
    crane['lon'],crane['lat'] = inverse.transform(crane.X.to_numpy(),crane.Y.to_numpy())
    crane['time'] = pd.to_datetime(crane.Time,format='%m/%d/%Y %H:%M',utc=True)
    crane['alt'] = np.nan
    journeys.append(normalize(crane,{'id':'sandhill_crane_2013','title':'Sandhill crane · Alaska to New Mexico',
        'subtitle':'From Arctic wetlands to the Southwest','individual':'100845','species':'Sandhill crane','scientificName':'Antigone canadensis',
        'flightStyle':'MIGRATORY WATERBIRD','description':'A real autumn 2013 GPS migration from Alaska to New Mexico. Sparse fixes reveal the broad route. Altitude was not released; first-person viewing height is illustrative.',
        'sourceDoi':CRANE_DOI,'studyId':'USGS F7F76BGR','licence':'U.S. public-domain data; USGS requests citation.',
        'citation':CRANE_CITATION,'publication':None,'altitudeField':None,'altitudeDatum':'Altitude is not included in the release. The camera uses an illustrative height of 750 m above loaded terrain.',
        'curation':'Individual 100845, 74 unique timestamps from 75 released locations; one duplicate timestamp removed, sorted by UTC time. Published X/Y coordinates inverted from azimuthal equidistant (centre 51° N, 110° W; GRS80; kilometre units). No GPS altitude or instantaneous speed is supplied.',
        'maxInterpolationGapSeconds':64800,'defaultCameraHeightM':750,'recommendedMode':'overview',
        'gapExplanation':'The tags were programmed for four GPS positions per day; this release has additional missing intervals. The reason for an individual gap is not recorded.',
        'resolutionNote':'Sparse GPS fixes · broad route · altitude unrecorded'},finder))
    output = ROOT/'data/04_multi_species/journeys.json'
    output.parent.mkdir(parents=True,exist_ok=True)
    output.write_text(json.dumps({'schemaVersion':2,'journeys':journeys},separators=(',',':')))
    manifest = {'accessDate':'2026-10-08','localTime':time_zone_provenance(),'sources':[
        {'doi':GOOSE_DOI,'metadata':'https://www.sciencebase.gov/catalog/item/659d8f29d34e3265ab163230?format=json',
         'file':'goose_migrationAltitude_nePacific_weiser.csv','sha256':hashlib.sha256(Path(args.geese).read_bytes()).hexdigest(),
         'selection':'used=1 only; two named bouts; model available-altitude rows excluded.'},
        {'doi':CRANE_DOI,'metadata':'https://www.sciencebase.gov/catalog/item/59a472d7e4b077f005673486?format=json',
         'file':'sacr_locations.csv','sha256':hashlib.sha256(Path(args.cranes).read_bytes()).hexdigest(),
         'coordinateMethod':'Inverse of the exact published AEQD/GRS80 parameters. Geographic coordinates used for landscape viewing; no survey-grade datum transformation claimed.'}],
        'tracks':[{k:j[k] for k in ['id','species','individual','curation','timeZones','medianIntervalSeconds','maxInterpolationGapSeconds','altitudeDatum']}|{'fixes':len(j['points'])} for j in journeys]}
    (ROOT/'resources/multi_species_manifest.json').write_text(json.dumps(manifest,indent=2))
    for journey in journeys:print(journey['id'],len(journey['points']),'fixes',journey['medianIntervalSeconds'],'seconds',journey['totalDistanceKm'],'km',journey['timeZones'])


if __name__=='__main__':
    main()
