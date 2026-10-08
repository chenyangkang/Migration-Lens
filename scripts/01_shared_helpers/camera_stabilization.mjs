import {sampleTrack,locateInterval,bearing,greatCircleDistance,sphericalInterpolate,normalizeHeading,clamp,radians,degrees} from './flight_math.mjs';

export const headingDifference=(from,to)=>((to-from+540)%360)-180;

// Bound turning by wall-clock time, even during accelerated or reverse playback.
export function stepCameraHeading(current,target,dt,{responseSeconds=1.4,maxRate=28,deadband=1.2}={}) {
  if(target==null)return current;
  if(current==null)return normalizeHeading(target);
  const delta=headingDifference(current,target),elapsed=clamp(dt,0,.25);
  if(Math.abs(delta)<=deadband)return current;
  const change=delta*(1-Math.exp(-elapsed/responseSeconds));
  return normalizeHeading(current+clamp(change,-maxRate*elapsed,maxRate*elapsed));
}

export function createCameraPath(journey) {
  const points=journey.points,bounds=Array(points.length);
  let start=0;
  for(let i=1;i<=points.length;i++){
    if(i===points.length||points[i][0]-points[i-1][0]>journey.maxInterpolationGapSeconds){
      const segment={start,end:i-1,id:start};
      for(let k=start;k<i;k++)bounds[k]=segment;
      start=i;
    }
  }
  const asPoint=sample=>[sample.time,sample.longitude,sample.latitude,null,null,null,sample.distance];
  const halfWindow=clamp(journey.medianIntervalSeconds*2,300,21600);
  function target(time) {
    const raw=sampleTrack(journey,time);
    const exactIndex=raw.fraction===1?raw.index+1:locateInterval(points,raw.time);
    const segment=bounds[exactIndex],first=points[segment.start][0],last=points[segment.end][0];
    const sample=t=>asPoint(sampleTrack(journey,clamp(t,first,last)));
    let heading=null;
    // A circling or nearly stationary bird has no reliable short-scale travel bearing.
    for(const factor of [1,2,3]){
      const a=sample(raw.time-halfWindow*factor),b=sample(raw.time+halfWindow*factor);
      const displacement=greatCircleDistance(a,b),travel=Math.max(0,(b[6]-a[6])*1000);
      if(displacement>=80&&displacement/Math.max(travel,1)>=.25){heading=bearing(a,b);break;}
    }
    let longitude=raw.longitude,latitude=raw.latitude;
    if(journey.medianIntervalSeconds<=300&&segment.start!==segment.end){
      const span=clamp(journey.medianIntervalSeconds,30,90),vector=[0,0,0];
      for(const [offset,weight] of [[-2,1],[-1,2],[0,3],[1,2],[2,1]]){
        const p=sample(raw.time+offset*span),lon=radians(p[1]),lat=radians(p[2]);
        vector[0]+=weight*Math.cos(lat)*Math.cos(lon);vector[1]+=weight*Math.cos(lat)*Math.sin(lon);vector[2]+=weight*Math.sin(lat);
      }
      const smoothed=[raw.time,degrees(Math.atan2(vector[1],vector[0])),degrees(Math.atan2(vector[2],Math.hypot(vector[0],vector[1])))];
      const original=asPoint(raw),offset=greatCircleDistance(original,smoothed);
      [longitude,latitude]=sphericalInterpolate(original,smoothed,Math.min(1,150/Math.max(offset,1)));
    }
    return {heading,longitude,latitude,segment:segment.id,raw};
  }
  return {target};
}
