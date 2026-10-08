import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {advancePlayback,recordingGaps,sampleTrack} from '../01_shared_helpers/flight_math.mjs';
const fixture={maxInterpolationGapSeconds:300,points:[[0,-112,33,400,10,180,0],[60,-112,32.99,500,12,180,1.1],[10000,-111,32,600,14,135,120],[10060,-110.99,32,700,15,90,121],[20000,-110,31,800,15,90,250],[20060,-109.99,31,850,15,90,251]]};

test('rewind preserves recorded elapsed time across multiple missing intervals',()=>{
  const backward=advancePlayback(fixture,20050,150,1,{direction:-1});
  assert.equal(backward.time,20);assert.equal(backward.skipped,true);
  const forward=advancePlayback(fixture,backward.time,150,1);
  assert.equal(forward.time,20050);assert.equal(forward.skipped,true);
});
test('reverse gap notices hold at the later recorded fix and resume at the earlier fix',()=>{
  const result=advancePlayback(fixture,10010,20,1,{direction:-1,stopAtGap:true});
  assert.equal(result.time,10000);assert.equal(result.gap.start,60);assert.equal(result.gap.end,10000);
  assert.equal(sampleTrack(fixture,result.time).altitude,600);
  const resumed=advancePlayback(fixture,result.gap.start,20,1,{direction:-1,stopAtGap:true});
  assert.equal(resumed.time,40);assert.equal(resumed.gap,undefined);
});
test('seeking from inside a gap spends only new recorded time in either direction',()=>{
  assert.equal(advancePlayback(fixture,5000,20,1).time,10020);
  assert.equal(advancePlayback(fixture,5000,20,1,{direction:-1}).time,40);
});
test('rewind clamps at the first observation and ends there',()=>{
  const result=advancePlayback(fixture,20050,100000,1,{direction:-1});
  assert.equal(result.time,0);assert.equal(result.ended,true);
  assert.equal(sampleTrack(fixture,result.time).altitude,400);
  assert.equal(advancePlayback(fixture,0,600,1,{direction:-1}).time,0);
});
test('every catalog gap supports announced and quiet backward transitions',()=>{
  const catalog=JSON.parse(readFileSync(new URL('../../resources/configs/journey_catalog.json',import.meta.url)));
  for(const file of catalog.datasets)for(const journey of JSON.parse(readFileSync(new URL('../../'+file,import.meta.url))).journeys){
    for(const gap of recordingGaps(journey)){
      const announced=advancePlayback(journey,gap.end,1,1,{direction:-1,stopAtGap:true});
      assert.equal(announced.time,gap.end);assert.deepEqual(announced.gap,gap);
      const quiet=advancePlayback(journey,gap.end,1,1,{direction:-1});
      assert.ok(quiet.time<=gap.start);assert.equal(quiet.skipped,true);assert.equal(quiet.gap,undefined);
    }
  }
});
