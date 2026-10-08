const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
export function windComponents(speed,fromDegrees){
  const angle=fromDegrees*Math.PI/180;
  return {u:-speed*Math.sin(angle),v:-speed*Math.cos(angle)};
}
export function windDescription(u,v){
  if(!Number.isFinite(u)||!Number.isFinite(v))return null;
  const speed=Math.hypot(u,v),toward=(Math.atan2(u,v)*180/Math.PI+360)%360,from=(toward+180)%360;
  return {speed,toward,from,cardinal:['N','NE','E','SE','S','SW','W','NW'][Math.round(from/45)%8]};
}
export function weatherIndex(data,time){
  if(time<data.startTime||time>=data.endTime+data.stepSeconds)return -1;
  return Math.floor((time-data.startTime)/data.stepSeconds);
}
export function indexWeather(data){
  data.lookup=new Map(data.nodes.map(node=>[`${node.lon},${node.lat}`,node]));
  return data;
}
export function sampleWeather(data,time,lon,lat){
  const index=weatherIndex(data,time);if(index<0)return null;
  const spacing=data.spacingDegrees,x=Math.floor(lon/spacing)*spacing,y=Math.floor(lat/spacing)*spacing;
  const dx=(lon-x)/spacing,dy=(lat-y)/spacing;
  const corners=[[x,y,(1-dx)*(1-dy)],[x+spacing,y,dx*(1-dy)],[x,y+spacing,(1-dx)*dy],[x+spacing,y+spacing,dx*dy]];
  const values=Array.from({length:4},(_,column)=>{
    let total=0;
    for(const [a,b,weight] of corners){
      if(weight<1e-9)continue;
      const value=data.lookup.get(`${a},${b}`)?.values[index]?.[column];
      if(!Number.isFinite(value))return null;
      total+=value*weight;
    }
    return total;
  });
  return {time:data.startTime+index*data.stepSeconds,temperature:values[0],precipitation:values[1],u:values[2],v:values[3],wind:windDescription(values[2],values[3])};
}
export function temperatureColor(value){
  const stops=[[-15,[73,114,208]],[0,[70,182,207]],[15,[99,205,159]],[30,[244,193,91]],[45,[222,95,86]]];
  const t=clamp(value,-15,45),i=Math.min(3,Math.floor((t+15)/15)),fraction=(t-stops[i][0])/15;
  return stops[i][1].map((channel,k)=>Math.round(channel+(stops[i+1][1][k]-channel)*fraction));
}
export function precipitationOpacity(value){return value>0?clamp(.18+Math.log1p(value)*.19,.18,.72):0;}
