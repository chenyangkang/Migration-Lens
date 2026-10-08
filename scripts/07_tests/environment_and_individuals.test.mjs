import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {windComponents,windDescription,indexWeather,sampleWeather,weatherIndex} from '../01_shared_helpers/environment_math.mjs';
import {individualsForSpecies,migrationsForIndividual} from '../01_shared_helpers/individual_catalog.mjs';
import {sampleTrack,recordingGaps,advancePlayback} from '../01_shared_helpers/flight_math.mjs';
const catalog=JSON.parse(readFileSync(new URL('../../resources/configs/journey_catalog.json',import.meta.url)));
const journeys=catalog.datasets.flatMap(file=>JSON.parse(readFileSync(new URL('../../'+file,import.meta.url))).journeys);

test('every species offers multiple distinct, identified birds',()=>{
  for(const species of new Set(journeys.map(j=>j.species))){
    assert.ok(individualsForSpecies(journeys,species).length>=2);
  }
  assert.equal(journeys.length,69);
});
test('one individual can select multiple actual migrations without mixing birds',()=>{
  const entries=migrationsForIndividual(journeys,'Greater white-fronted goose','gwf_171615.1');
  assert.equal(entries.length,2);
  assert.deepEqual(entries.map(j=>new Date(j.points[0][0]*1000).getUTCFullYear()),[2021,2019]);
  assert.equal(migrationsForIndividual(journeys,'Snow goose','gwf_171615.1').length,0);
});
test('meteorological from directions produce arrows toward the opposite direction',()=>{
  const north=windComponents(10,0),east=windComponents(10,90);
  assert.ok(Math.abs(north.u)<1e-9);assert.equal(north.v,-10);
  assert.ok(Math.abs(east.v)<1e-9);assert.equal(east.u,-10);
  assert.equal(windDescription(north.u,north.v).toward,180);
  assert.equal(windDescription(east.u,east.v).cardinal,'E');
});
test('vector interpolation handles winds straddling north; hourly precipitation is held',()=>{
  const a=windComponents(10,359),b=windComponents(10,1);
  const data=indexWeather({startTime:0,endTime:3600,stepSeconds:3600,spacingDegrees:1,nodes:[
    {lon:0,lat:0,values:[[10,2,a.u,a.v],[20,0,0,0]]},
    {lon:1,lat:0,values:[[20,4,b.u,b.v],[20,0,0,0]]},
    {lon:0,lat:1,values:[[10,2,a.u,a.v],[20,0,0,0]]},
    {lon:1,lat:1,values:[[20,4,b.u,b.v],[20,0,0,0]]}]});
  const reading=sampleWeather(data,3599,.5,.5);
  assert.equal(reading.temperature,15);assert.equal(reading.precipitation,3);assert.equal(reading.time,0);
  assert.ok(reading.wind.from<.01||reading.wind.from>359.99);
  assert.equal(sampleWeather(data,3600,.5,.5).precipitation,0);
  assert.equal(weatherIndex(data,-1),-1);assert.equal(weatherIndex(data,7200),-1);
  data.nodes[0].values[0][0]=null;assert.equal(sampleWeather(data,0,.5,.5).temperature,null);
  assert.equal(sampleWeather(data,0,4,4).wind,null);
});
test('packaged weather covers every recorded fix and short interpolated segment',()=>{
  for(const journey of journeys){
    const data=indexWeather(JSON.parse(readFileSync(new URL(`../../data/06_environment/${journey.id}.json`,import.meta.url))));
    assert.equal(data.journey,journey.id);
    assert.ok(data.nodes.every(n=>n.values.length===(data.endTime-data.startTime)/3600+1));
    for(let i=0;i<journey.points.length;i++){
      const p=journey.points[i],value=sampleWeather(data,p[0],p[1],p[2]);
      assert.ok(value&&Number.isFinite(value.temperature)&&value.wind,`${journey.id} fix ${i} weather missing`);
      if(i&&p[0]-journey.points[i-1][0]<=journey.maxInterpolationGapSeconds){
        for(const fraction of [.1,.25,.5,.75,.9]){
          const previous=journey.points[i-1],time=previous[0]+(p[0]-previous[0])*fraction,sample=sampleTrack(journey,time);
          const interpolated=sampleWeather(data,time,sample.longitude,sample.latitude);
          assert.ok(interpolated&&Number.isFinite(interpolated.temperature)&&interpolated.wind,`${journey.id} segment ${i} at ${fraction} weather missing`);
        }
      }
    }
  }
});
test('quiet playback jumps immediately across gaps; announced playback holds',()=>{
  for(const journey of journeys)for(const gap of recordingGaps(journey)){
    const quiet=advancePlayback(journey,gap.start,1,60,{stopAtGap:false});
    assert.equal(quiet.skipped,true);assert.ok(quiet.time>=gap.end);assert.equal(quiet.gap,undefined);
    const announced=advancePlayback(journey,gap.start,1,60,{stopAtGap:true});
    assert.equal(announced.time,gap.start);assert.ok(announced.gap);
  }
});
