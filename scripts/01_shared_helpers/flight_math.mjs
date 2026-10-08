export const radians = value => value * Math.PI / 180;
export const degrees = value => value * 180 / Math.PI;
export const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
export const normalizeHeading = value => ((value % 360) + 360) % 360;

export function greatCircleDistance(a, b) {
  const p1=radians(a[2]), p2=radians(b[2]);
  const dl=radians(b[1]-a[1]), dp=p2-p1;
  const h=Math.sin(dp/2)**2+Math.cos(p1)*Math.cos(p2)*Math.sin(dl/2)**2;
  return 6371008.8*2*Math.atan2(Math.sqrt(h),Math.sqrt(Math.max(0,1-h)));
}

export function bearing(a,b) {
  const p1=radians(a[2]),p2=radians(b[2]),d=radians(b[1]-a[1]);
  return normalizeHeading(degrees(Math.atan2(Math.sin(d)*Math.cos(p2),Math.cos(p1)*Math.sin(p2)-Math.sin(p1)*Math.cos(p2)*Math.cos(d))));
}

export function locateInterval(points, time) {
  let low=0,high=points.length-1;
  while(low<high){const middle=Math.ceil((low+high)/2);if(points[middle][0]<=time)low=middle;else high=middle-1;}
  return Math.min(low,points.length-2);
}

export function sphericalInterpolate(a,b,fraction) {
  const vector=p=>{const lon=radians(p[1]),lat=radians(p[2]);return [Math.cos(lat)*Math.cos(lon),Math.cos(lat)*Math.sin(lon),Math.sin(lat)];};
  const av=vector(a),bv=vector(b),angle=Math.acos(clamp(av.reduce((sum,v,i)=>sum+v*bv[i],0),-1,1));
  const wa=angle<1e-6?1-fraction:Math.sin((1-fraction)*angle)/Math.sin(angle);
  const wb=angle<1e-6?fraction:Math.sin(fraction*angle)/Math.sin(angle);
  const v=av.map((x,i)=>wa*x+wb*bv[i]);
  return [degrees(Math.atan2(v[1],v[0])),degrees(Math.atan2(v[2],Math.hypot(v[0],v[1])))];
}

export function sampleTrack(journey,time) {
  const points=journey.points;
  const clamped=clamp(time,points[0][0],points.at(-1)[0]);
  const index=locateInterval(points,clamped),a=points[index],b=points[index+1],interval=b[0]-a[0];
  const gap=interval>journey.maxInterpolationGapSeconds;
  const fraction=gap?(clamped>=b[0]?1:0):clamp((clamped-a[0])/interval,0,1);
  const [longitude,latitude]=sphericalInterpolate(a,b,fraction);
  const altitude=a[3]!=null&&b[3]!=null?a[3]+(b[3]-a[3])*fraction:null;
  const speed=a[4]!=null&&b[4]!=null?a[4]+(b[4]-a[4])*fraction:greatCircleDistance(a,b)/Math.max(interval,1);
  let direction=greatCircleDistance(a,b)>3?bearing(a,b):(a[5]??b[5]??0);
  if(index>0&&greatCircleDistance(a,b)<=3)direction=points[index-1][5]??direction;
  return {time:clamped,index,longitude,latitude,altitude,speed,speedMeasured:a[4]!=null&&b[4]!=null,heading:direction,distance:a[6]+(b[6]-a[6])*fraction,gap,interval,fraction};
}

export function recordingGaps(journey) {
  return journey.points.slice(1).flatMap((point,index)=>{
    const previous=journey.points[index],duration=point[0]-previous[0];
    return duration>journey.maxInterpolationGapSeconds?[{start:previous[0],end:point[0],duration,fromIndex:index,toIndex:index+1}]:[];
  });
}

export function advancePlayback(journey,currentTime,elapsedSeconds,multiplier,{stopAtGap=false}={}) {
  const points=journey.points,end=points.at(-1)[0];
  let target=Math.min(end,currentTime+elapsedSeconds*multiplier),skipped=false;
  // Never fly invented paths across missing data or overnight gaps.
  for(let i=locateInterval(points,currentTime);i<points.length-1&&points[i][0]<=target;i++){
    const a=points[i],b=points[i+1];
    if(b[0]-a[0]>journey.maxInterpolationGapSeconds&&target>a[0]&&currentTime<b[0]){
      if(stopAtGap)return {time:Math.max(a[0],currentTime),skipped:false,ended:false,gap:{start:a[0],end:b[0],duration:b[0]-a[0],fromIndex:i,toIndex:i+1}};
      target=Math.min(end,b[0]+Math.max(0,target-a[0]));skipped=true;
    }
  }
  return {time:target,skipped,ended:target>=end};
}

export function validSegments(journey) {
  const segments=[];let segment=[];
  for(let i=0;i<journey.points.length;i++){
    if(i&&journey.points[i][0]-journey.points[i-1][0]>journey.maxInterpolationGapSeconds){if(segment.length>1)segments.push(segment);segment=[];}
    segment.push(journey.points[i]);
  }
  if(segment.length>1)segments.push(segment);
  return segments;
}
