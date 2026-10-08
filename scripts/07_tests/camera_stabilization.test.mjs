import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createCameraPath,stepCameraHeading,headingDifference} from '../01_shared_helpers/camera_stabilization.mjs';
import {sampleTrack,greatCircleDistance} from '../01_shared_helpers/flight_math.mjs';

function track(positions,{gap=120,interval=30}={}) {
  let distance=0;
  const points=positions.map(([lon,lat],i)=>{
    if(i)distance+=greatCircleDistance([0,...positions[i-1]],[0,lon,lat])/1000;
    return [i*interval,lon,lat,200,null,null,distance];
  });
  return {points,medianIntervalSeconds:interval,maxInterpolationGapSeconds:gap};
}

test('circular heading interpolation takes the short turn through north',()=>{
  const value=stepCameraHeading(359,1,.1,{deadband:0});
  assert.ok(value>359&&value<360);
  assert.equal(stepCameraHeading(42,null,.2),42);
});
test('turn rate stays bounded in wall time and converges on a genuine turn',()=>{
  let heading=0;
  for(let i=0;i<240;i++){
    const next=stepCameraHeading(heading,90,1/30);
    assert.ok(Math.abs(headingDifference(heading,next))<=28/30+1e-9);
    heading=next;
  }
  assert.ok(Math.abs(headingDifference(heading,90))<2);
  assert.ok(Math.abs(headingDifference(0,stepCameraHeading(0,180,9)))<=7);
});
test('stationary GPS jitter has no reliable forward direction',()=>{
  const journey=track(Array.from({length:100},(_,i)=>[.00003*Math.sin(i),.00003*Math.cos(i)]));
  const path=createCameraPath(journey);
  for(const p of journey.points)assert.equal(path.target(p[0]).heading,null);
});
test('stable direction follows sustained turns and does not reverse during rewind',()=>{
  const positions=Array.from({length:80},(_,i)=>i<40?[i*.001,0]:[.039,(i-39)*.001]);
  const journey=track(positions),path=createCameraPath(journey);
  assert.ok(Math.abs(headingDifference(path.target(300).heading,90))<1);
  assert.ok(Math.abs(headingDifference(path.target(2100).heading,0))<1);
  for(let time=2100;time>=1800;time-=30)assert.ok(Math.abs(headingDifference(path.target(time).heading,0))<1);
});
test('heading and camera position smoothing never cross a missing-data gap',()=>{
  const journey=track(Array.from({length:30},(_,i)=>i<15?[i*.001,0]:[20,(i-15)*.001]));
  for(let i=15;i<journey.points.length;i++)journey.points[i][0]+=10000;
  const path=createCameraPath(journey),before=path.target(journey.points[14][0]),after=path.target(journey.points[15][0]);
  assert.equal(before.segment,0);assert.equal(after.segment,15);
  assert.ok(Math.abs(headingDifference(before.heading,90))<1);
  assert.ok(Math.abs(headingDifference(after.heading,0))<1);
  assert.ok(before.longitude<.02&&Math.abs(after.longitude-20)<1e-8);
});
test('Peter’s actual track has substantially fewer heading oscillations without changing fixes',()=>{
  const journey=JSON.parse(readFileSync(new URL('../../data/03_data_preparation/journeys.json',import.meta.url))).journeys.find(j=>j.id==='peter_2021');
  const original=JSON.stringify(journey.points),path=createCameraPath(journey);
  let raw=0,stable=0,previousRaw=null,previousStable=null;
  for(const point of journey.points){
    const sample=sampleTrack(journey,point[0]),target=path.target(point[0]);
    if(!sample.gap&&previousRaw!==null)raw+=Math.abs(headingDifference(previousRaw,sample.heading));
    if(!sample.gap&&previousStable!==null&&target.heading!==null)stable+=Math.abs(headingDifference(previousStable,target.heading));
    previousRaw=sample.gap?null:sample.heading;previousStable=sample.gap?null:target.heading;
    assert.ok(greatCircleDistance(point,[point[0],target.longitude,target.latitude])<=150.01);
  }
  assert.ok(stable<raw*.3,`Heading variation: raw ${raw}, stable ${stable}`);
  assert.equal(JSON.stringify(journey.points),original);
});
