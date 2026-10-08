import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {sampleTrack,advancePlayback,greatCircleDistance,sphericalInterpolate,validSegments} from '../01_shared_helpers/flight_math.mjs';
const fixture={maxInterpolationGapSeconds:300,points:[[0,-112,33,400,10,180,0],[60,-112,32.99,500,12,180,1.1],[10000,-111,32,600,14,135,120],[10060,-110.99,32,700,15,90,121]]};

test('interpolation follows observed position, height and speed',()=>{
  const p=sampleTrack(fixture,30);assert.equal(p.altitude,450);assert.equal(p.speed,11);assert.ok(Math.abs(p.latitude-32.995)<.000001);assert.equal(p.gap,false);
});
test('missing observations never create a flight across a long gap',()=>{
  const p=sampleTrack(fixture,5000);assert.equal(p.longitude,-112);assert.equal(p.altitude,500);assert.equal(p.gap,true);assert.equal(validSegments(fixture).length,2);
});
test('playback skips an overnight gap and preserves elapsed motion',()=>{
  const result=advancePlayback(fixture,50,20,1);assert.equal(result.time,10010);assert.equal(result.skipped,true);
});
test('the last observed point is reachable and playback ends',()=>{
  const result=advancePlayback(fixture,10050,100,1);assert.equal(result.time,10060);assert.equal(result.ended,true);assert.equal(sampleTrack(fixture,10060).longitude,-110.99);
});
test('great-circle interpolation crosses the date line rather than Greenwich',()=>{
  const midpoint=sphericalInterpolate([0,179,0],[60,-179,0],.5);assert.ok(Math.abs(Math.abs(midpoint[0])-180)<.000001);assert.ok(greatCircleDistance([0,179,0],[60,-179,0])<223000);
});
test('packaged observations are ordered, finite and geographically valid',()=>{
  const {journeys}=JSON.parse(readFileSync(new URL('../../data/03_data_preparation/journeys.json',import.meta.url),'utf8'));
  assert.equal(journeys.length,2);
  for(const j of journeys){assert.ok(j.points.length>100);for(let i=0;i<j.points.length;i++){const p=j.points[i];assert.ok(p.slice(0,4).every(Number.isFinite));assert.ok(Math.abs(p[1])<=180&&Math.abs(p[2])<=90);if(i)assert.ok(p[0]>j.points[i-1][0]);}for(const day of j.days){assert.ok(day.endIndex>=day.startIndex);assert.ok(day.endIndex<j.points.length);}assert.ok(j.points[j.previewIndex]);}
});
