import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {sampleTrack} from '../01_shared_helpers/flight_math.mjs';
import {formatFlightTime,timeZoneAt,solarElevation,lightPhase} from '../01_shared_helpers/time_and_light.mjs';
const timestamp = iso => Date.parse(iso) / 1000;
const data = JSON.parse(readFileSync(new URL('../../data/03_data_preparation/journeys.json',import.meta.url),'utf8'));

test('bird local time differs from UTC and uses the historical Sinaloa DST rule',()=>{
  const instant=timestamp('2021-09-21T23:30:00Z');
  assert.equal(formatFlightTime(instant,'America/Phoenix').time,'16:30');
  const sinaloa=formatFlightTime(instant,'America/Mazatlan');
  assert.equal(sinaloa.time,'17:30');assert.equal(sinaloa.offset,'UTC-6');assert.equal(sinaloa.utcTime,'23:30');
  assert.equal(formatFlightTime(timestamp('2023-09-21T23:30:00Z'),'America/Mazatlan').offset,'UTC-7');
});
test('civil dates and midnight formatting are independent of the viewer timezone',()=>{
  const clock=formatFlightTime(timestamp('2021-09-22T00:30:00Z'),'America/Mazatlan');
  assert.equal(clock.date,'Sep 21, 2021');assert.equal(clock.utcDate,'Sep 22, 2021');
  assert.equal(formatFlightTime(timestamp('2021-09-22T06:00:00Z'),'America/Mazatlan').time,'00:00');
});
test('zone changes use the nearest observed fix and do not cross a missing-data gap',()=>{
  const journey={timeZones:['America/Phoenix','America/Mazatlan'],points:[[0,0,0,0,0,0,0,0],[60,0,0,0,0,0,0,1]]};
  assert.equal(timeZoneAt(journey,{index:0,fraction:.4,gap:false}),'America/Phoenix');
  assert.equal(timeZoneAt(journey,{index:0,fraction:.6,gap:false}),'America/Mazatlan');
  assert.equal(timeZoneAt(journey,{index:0,fraction:.9,gap:true}),'America/Phoenix');
});
test('packaged zones keep historical geography and every flight day matches its civil date',()=>{
  const peter=data.journeys.find(j=>j.id==='peter_2021');
  assert.deepEqual(peter.timeZones,['America/Phoenix','America/Hermosillo','America/Mazatlan']);
  assert.equal(timeZoneAt(peter,sampleTrack(peter,peter.points.at(-1)[0])),'America/Mazatlan');
  for(const journey of data.journeys){
    let total=0;
    for(const day of journey.days){
      assert.equal(day.fixes,day.endIndex-day.startIndex+1);total+=day.fixes;
      for(let i=day.startIndex;i<=day.endIndex;i++){
        const point=journey.points[i],zone=journey.timeZones[point[7]];
        assert.ok(zone);const expected=new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(point[0]*1000));
        assert.equal(day.date,expected);
      }
    }
    assert.equal(total,journey.points.length);
  }
});
test('the sun moves from daylight through twilight into night at a held GPS position',()=>{
  const lon=-112.66,lat=33.36;
  const noon=solarElevation(timestamp('2021-09-03T19:51:32Z'),lon,lat);
  const twilight=solarElevation(timestamp('2021-09-04T02:10:00Z'),lon,lat);
  const midnight=solarElevation(timestamp('2021-09-04T07:00:00Z'),lon,lat);
  assert.ok(noon>60&&noon<68);assert.equal(lightPhase(noon).kind,'day');
  assert.ok(twilight<-.833&&twilight>-6);assert.equal(lightPhase(twilight).name,'Civil twilight');
  assert.ok(midnight<-45);assert.equal(lightPhase(midnight).kind,'night');
});
test('solar geometry handles leap years, southern latitudes and polar night',()=>{
  assert.ok(solarElevation(timestamp('2024-02-29T12:00:00Z'),0,0)>80);
  assert.ok(solarElevation(timestamp('2021-12-21T12:00:00Z'),0,-23.44)>88);
  assert.equal(lightPhase(solarElevation(timestamp('2021-12-21T00:00:00Z'),0,80)).kind,'night');
});
