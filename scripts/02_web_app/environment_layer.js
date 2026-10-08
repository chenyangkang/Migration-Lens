import {indexWeather,sampleWeather,weatherIndex,windDescription,temperatureColor,precipitationOpacity} from './environment_math.mjs';

export class EnvironmentLayer{
  constructor(viewer,C,onChange){this.viewer=viewer;this.C=C;this.onChange=onChange;this.data=null;this.layers=[];this.entities=[];this.localEntities=[];this.localKey='';this.cache=new Map();this.generation=0;this.key='';this.loading=false;this.error=false;}
  clear(){for(const entity of this.entities)this.viewer.entities.remove(entity);this.entities=[];for(const entity of this.localEntities)this.viewer.entities.remove(entity);this.localEntities=[];this.localKey='';this.key='';this.viewer.scene.requestRender();}
  async setJourney(journey){
    const generation=++this.generation;this.journey=journey;this.data=null;this.error=false;this.loading=false;this.clear();this.onChange();
    if(!this.layers.length)return;
    await this.load(generation);
  }
  async load(generation=this.generation){
    if(this.loading||this.data||this.error)return;
    this.loading=true;this.onChange();
    try{
      const id=this.journey.id;
      let data=this.cache.get(id);
      if(!data){const response=await fetch(`data/environment/${id}.json`);if(!response.ok)throw new Error('Weather unavailable');data=indexWeather(await response.json());this.cache.set(id,data);if(this.cache.size>3)this.cache.delete(this.cache.keys().next().value);}
      if(generation!==this.generation)return;
      this.data=data;
    }catch{if(generation===this.generation)this.error=true;}
    finally{if(generation===this.generation){this.loading=false;this.onChange();}}
  }
  setLayers(layers){this.layers=[...layers];this.clear();if(this.layers.length&&this.journey)this.load();this.onChange();}
  sample(time,lon,lat){return this.data?sampleWeather(this.data,time,lon,lat):null;}
  updateLocalWind(time,position){
    const index=weatherIndex(this.data,time),key=`${index}|${Math.floor(position.longitude*50)}|${Math.floor(position.latitude*50)}`;
    if(key===this.localKey)return;
    for(const entity of this.localEntities)this.viewer.entities.remove(entity);this.localEntities=[];this.localKey=key;
    if(!this.layers.includes('wind')||index<0)return;
    const C=this.C;
    for(let x=-2;x<=2;x++)for(let y=-2;y<=2;y++){
      const lon=position.longitude+x*.015,lat=position.latitude+y*.015;
      const vector=this.sample(time,lon,lat)?.wind;if(!vector||vector.speed<.15)continue;
      const length=Math.min(.009,.002+vector.speed*.00035),angle=vector.toward*Math.PI/180;
      const dx=Math.sin(angle)*length/Math.max(.2,Math.cos(lat*Math.PI/180)),dy=Math.cos(angle)*length;
      this.localEntities.push(this.viewer.entities.add({polyline:{positions:C.Cartesian3.fromDegreesArray([lon-dx/2,lat-dy/2,lon+dx/2,lat+dy/2]),width:4,clampToGround:true,material:new C.PolylineArrowMaterialProperty(C.Color.fromCssColorString('#e8fff1').withAlpha(.8))}}));
    }
  }
  update(time,position){
    if(!this.layers.length||!this.data)return;
    this.updateLocalWind(time,position);
    const index=weatherIndex(this.data,time),key=`${index}|${this.layers.join(',')}`;
    if(key===this.key)return;
    for(const entity of this.entities)this.viewer.entities.remove(entity);this.entities=[];this.key=key;if(index<0)return;
    const C=this.C,wind=this.layers.includes('wind'),temperature=this.layers.includes('temperature'),rain=this.layers.includes('precipitation');
    for(const node of this.data.nodes){
      const values=node.values[index];if(!values)continue;
      const coordinates=C.Rectangle.fromDegrees(node.lon-.5,node.lat-.5,node.lon+.5,node.lat+.5);
      if(temperature&&Number.isFinite(values[0])){
        const rgb=temperatureColor(values[0]);this.entities.push(this.viewer.entities.add({rectangle:{coordinates,material:C.Color.fromBytes(...rgb).withAlpha(.31)}}));
      }
      if(rain&&Number.isFinite(values[1])&&values[1]>0){
        this.entities.push(this.viewer.entities.add({rectangle:{coordinates,material:C.Color.fromBytes(75,149,255).withAlpha(precipitationOpacity(values[1])),zIndex:1}}));
      }
      const vector=windDescription(values[2],values[3]);
      if(wind&&vector&&vector.speed>.15){
        const length=Math.min(.36,.05+vector.speed*.016),angle=vector.toward*Math.PI/180;
        const dx=Math.sin(angle)*length/Math.max(.2,Math.cos(node.lat*Math.PI/180)),dy=Math.cos(angle)*length;
        this.entities.push(this.viewer.entities.add({polyline:{positions:C.Cartesian3.fromDegreesArray([node.lon-dx/2,node.lat-dy/2,node.lon+dx/2,node.lat+dy/2]),width:5,clampToGround:true,material:new C.PolylineArrowMaterialProperty(C.Color.fromCssColorString('#e8fff1').withAlpha(.9))}}));
      }
    }
    this.viewer.scene.requestRender();
  }
}
