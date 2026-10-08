import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {sampleTrack,advancePlayback,recordingGaps} from '../01_shared_helpers/flight_math.mjs';
import {gapDetails} from '../01_shared_helpers/gap_details.mjs';
import {validateJourneys} from '../01_shared_helpers/journey_schema.mjs';
import {solarElevation} from '../01_shared_helpers/time_and_light.mjs';
const catalog=JSON.parse(readFileSync(new URL('../../resources/configs/journey_catalog.json',import.meta.url)));
const journeys=catalog.datasets.flatMap(file=>JSON.parse(readFileSync(new URL('../../'+file,import.meta.url))).journeys);

test('all four species share a validated catalog with unique journey identities',()=>{
  assert.equal(validateJourneys(journeys).length,5);
  assert.equal(new Set(journeys.map(j=>j.species)).size,4);
  assert.throws(()=>validateJourneys([...journeys,journeys[0]]),/unique/);
});
test('playback stops before a real gap, then can resume from the exact next recorded fix',()=>{
  for(const journey of journeys){
    for(const gap of recordingGaps(journey)){
      const result=advancePlayback(journey,gap.start,1,3600,{stopAtGap:true});
      assert.equal(result.time,gap.start);assert.equal(result.skipped,false);assert.deepEqual(result.gap,gap);
      const held=sampleTrack(journey,gap.start+gap.duration/2);
      assert.ok(Math.abs(held.longitude-journey.points[gap.fromIndex][1])<1e-7);
      assert.equal(held.distance,journey.points[gap.fromIndex][6]);
      const resumed=sampleTrack(journey,gap.end);
      assert.ok(Math.abs(resumed.latitude-journey.points[gap.toIndex][2])<1e-7);
    }
  }
});
test('gap explanation preserves source uncertainty and switches local/UTC endpoints',()=>{
  const journey=journeys.find(j=>j.id==='snow_goose_2019'),gap=recordingGaps(journey)[0];
  const local=gapDetails(journey,gap),utc=gapDetails(journey,gap,'utc');
  assert.match(local.explanation,/cause is not specified/);
  assert.match(utc.from,/UTC$/);assert.notEqual(local.from,utc.from);
  assert.ok(local.duration);assert.match(local.nightNote,/does not establish|not inferred/);
});
test('unreleased crane height remains unknown and segment speed remains an estimate',()=>{
  const crane=journeys.find(j=>j.id==='sandhill_crane_2013');
  assert.ok(crane.points.every(p=>p[3]===null&&p[4]===null));
  const sample=sampleTrack(crane,crane.points[0][0]+30);
  assert.equal(sample.altitude,null);assert.equal(sample.speedMeasured,false);assert.ok(Number.isFinite(sample.speed));
  assert.equal(crane.recommendedMode,'overview');assert.equal(crane.points.length,74);
});
test('goose catalog retains genuine nighttime observations with measured GPS heights',()=>{
  for(const journey of journeys.filter(j=>j.species.includes('goose'))){
    assert.equal(journey.medianIntervalSeconds,900);
    assert.ok(journey.points.some(p=>solarElevation(p[0],p[1],p[2])<-6));
    assert.ok(journey.points.every(p=>Number.isFinite(p[3])&&p[4]===null));
  }
});
