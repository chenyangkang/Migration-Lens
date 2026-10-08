import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {greatCircleDistance} from '../01_shared_helpers/flight_math.mjs';
import {formatFlightTime} from '../01_shared_helpers/time_and_light.mjs';
const config=JSON.parse(readFileSync(new URL('../../resources/configs/journey_catalog.json',import.meta.url)));
const journeys=config.datasets.flatMap(file=>JSON.parse(readFileSync(new URL('../../'+file,import.meta.url))).journeys);
const added=JSON.parse(readFileSync(new URL('../../data/08_diverse_migrations/journeys.json',import.meta.url))).journeys;

test('expanded catalog offers real individuals across twelve species and ten source releases',()=>{
  assert.equal(new Set(journeys.map(j=>j.species)).size,12);
  assert.equal(new Set(journeys.map(j=>j.species+'|'+j.individual)).size,68);
  assert.equal(new Set(journeys.map(j=>j.sourceDoi)).size,10);
  for(const journey of added){
    const source=new URL(journey.sourceDoi);
    assert.equal(source.hostname,'doi.org');assert.match(source.pathname,/^\/10\./);
    assert.ok(journey.citation&&journey.licence&&journey.curation);
    const displacement=greatCircleDistance(journey.points[0],journey.points.at(-1));
    assert.ok(displacement>(journey.species==='Black kite'?10000:100000),`${journey.id} must show migration travel`);
  }
});
test('new Movebank selections retain traceable source event identifiers without synthetic fixes',()=>{
  for(const journey of added.filter(j=>j.pointSourceEventIds)){
    assert.equal(journey.pointSourceEventIds.length,journey.points.length);
    assert.equal(new Set(journey.pointSourceEventIds).size,journey.points.length);
    assert.ok(journey.sourceFixCount>=journey.points.length);
    assert.ok(journey.pointSourceEventIds.every(id=>/^\d+$/.test(id)));
  }
});
test('unusable pelican and barnacle heights remain unknown and sparse tracks open in Route view',()=>{
  for(const journey of added.filter(j=>['Brown pelican','Barnacle goose','Orinoco goose'].includes(j.species))){
    assert.ok(journey.points.every(p=>p[3]===null));
    assert.equal(journey.altitudeField,null);assert.equal(journey.recommendedMode,'overview');
    assert.match(journey.altitudeDatum,/illustrative/);
  }
  assert.equal(journeys.filter(j=>j.subspecies?.includes('Tule')).length,5);
});
test('local-day groups cover all expanded migration fixes across hemispheres',()=>{
  const formatters=new Map();
  for(const journey of added){
    for(const day of journey.days){
      for(let i=day.startIndex;i<=day.endIndex;i++){
        const point=journey.points[i],zone=journey.timeZones[point[7]];
        if(!formatters.has(zone))formatters.set(zone,new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit'}));
        assert.equal(day.date,formatters.get(zone).format(new Date(point[0]*1000)),journey.id);
      }
    }
  }
  const female=added.find(j=>j.id==='orinoco_goose_gbfemale1_2010');
  assert.ok(female.timeZones.includes('America/La_Paz'));
  assert.equal(formatFlightTime(female.points.at(-1)[0],'America/La_Paz').offset,'UTC-4');
});
