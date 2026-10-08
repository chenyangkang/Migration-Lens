"""Enrich the packaged journeys with full civil timezone metadata."""
from pathlib import Path
import json
import sys
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / '01_shared_helpers'))
from local_time_metadata import annotate_time_zones, time_zone_provenance
from timezonefinder import TimezoneFinder

ROOT = Path(__file__).resolve().parents[2]
path = ROOT / 'data/03_data_preparation/journeys.json'
data = json.loads(path.read_text())
finder = TimezoneFinder(in_memory=True)
for journey in data['journeys']:
    annotate_time_zones(journey, finder)
    print(journey['id'], journey['timeZones'], len(journey['days']), 'civil flight days')
data['schemaVersion'] = 2
path.write_text(json.dumps(data, separators=(',', ':')))
manifest_path = ROOT / 'resources/data_manifest.json'
manifest = json.loads(manifest_path.read_text())
manifest['localTime'] = time_zone_provenance()
for entry, journey in zip(manifest['tracks'], data['journeys']):
    entry['curation'] = journey['curation']
    entry['days'] = len(journey['days'])
    entry['timeZones'] = journey['timeZones']
manifest_path.write_text(json.dumps(manifest, indent=2))
