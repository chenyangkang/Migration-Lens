import {weatherIndex,windDescription,temperatureColor,precipitationOpacity} from './environment_math.mjs';
import {sampleTrack} from './flight_math.mjs';
const project=(lon,lat,zoom)=>{const n=256*2**zoom,r=lat*Math.PI/180;return [(lon+180)/360*n,(1-Math.asinh(Math.tan(r))/Math.PI)/2*n];};
export class MiniMap{
  constructor(canvas){this.canvas=canvas;this.tiles=new Map();this.journey=null;this.time=0;this.environment=null;this.layers=[];new ResizeObserver(()=>this.draw()).observe(canvas);}
  setJourney(journey){this.journey=journey;this.draw();}
  setEnvironment(data,layers){this.environment=data;this.layers=layers;}
  update(time){this.time=time;this.draw();}
  tile(z,x,y){const key=`${z}/${x}/${y}`;if(this.tiles.has(key))return this.tiles.get(key);const img=new Image();img.crossOrigin='anonymous';img.onload=()=>this.draw();img.onerror=()=>{img.failed=true;};img.src=`https://tile.openstreetmap.org/${key}.png`;this.tiles.set(key,img);return img;}
  draw(){
    if(!this.journey)return;
    const width=this.canvas.clientWidth,height=this.canvas.clientHeight,dpr=Math.min(devicePixelRatio,2);
    if(!width||!height)return;
    if(this.canvas.width!==width*dpr||this.canvas.height!==height*dpr){this.canvas.width=width*dpr;this.canvas.height=height*dpr;}
    const ctx=this.canvas.getContext('2d');ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,width,height);ctx.fillStyle='#1b3d3e';ctx.fillRect(0,0,width,height);
    const points=this.journey.points;let zoom=7,bounds;
    while(zoom>=1){const p=points.map(p=>project(p[1],p[2],zoom));bounds=[Math.min(...p.map(v=>v[0])),Math.min(...p.map(v=>v[1])),Math.max(...p.map(v=>v[0])),Math.max(...p.map(v=>v[1]))];if((bounds[2]-bounds[0]<width-35&&bounds[3]-bounds[1]<height-30)||zoom===1)break;zoom--;}
    const current=sampleTrack(this.journey,this.time),weatherMode=this.layers.length>0;
    if(weatherMode)zoom=6;
    const center=weatherMode?project(current.longitude,current.latitude,zoom):[(bounds[0]+bounds[2])/2,(bounds[1]+bounds[3])/2];
    const ox=center[0]-width/2,oy=center[1]-height/2,n=2**zoom;
    for(let x=Math.floor(ox/256);x<=Math.floor((ox+width)/256);x++)for(let y=Math.floor(oy/256);y<=Math.floor((oy+height)/256);y++){
      if(y<0||y>=n)continue;const img=this.tile(zoom,((x%n)+n)%n,y);
      if(img.complete&&img.naturalWidth){ctx.globalAlpha=.72;ctx.drawImage(img,x*256-ox,y*256-oy,256,256);ctx.globalAlpha=1;}
    }
    ctx.fillStyle='rgba(8,38,35,.25)';ctx.fillRect(0,0,width,height);
    if(weatherMode&&this.environment){
      const index=weatherIndex(this.environment,this.time);
      for(const node of this.environment.nodes){
        const values=node.values[index];if(!values)continue;
        const a=project(node.lon-.5,node.lat+.5,zoom),b=project(node.lon+.5,node.lat-.5,zoom);
        if(b[0]<ox||a[0]>ox+width||b[1]<oy||a[1]>oy+height)continue;
        if(this.layers.includes('temperature')&&Number.isFinite(values[0])){ctx.fillStyle=`rgba(${temperatureColor(values[0]).join(',')},.48)`;ctx.fillRect(a[0]-ox,a[1]-oy,b[0]-a[0],b[1]-a[1]);}
        if(this.layers.includes('precipitation')&&Number.isFinite(values[1])&&values[1]>0){ctx.fillStyle=`rgba(75,149,255,${precipitationOpacity(values[1])})`;ctx.fillRect(a[0]-ox,a[1]-oy,b[0]-a[0],b[1]-a[1]);}
        const wind=windDescription(values[2],values[3]);
        if(this.layers.includes('wind')&&wind&&wind.speed>.15){
          const [x,y]=project(node.lon,node.lat,zoom),angle=wind.toward*Math.PI/180,length=Math.min(30,6+wind.speed*1.2);
          ctx.save();ctx.translate(x-ox,y-oy);ctx.rotate(angle);ctx.strokeStyle='#193e37';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(0,length/2);ctx.lineTo(0,-length/2);ctx.lineTo(-4,-length/2+6);ctx.moveTo(0,-length/2);ctx.lineTo(4,-length/2+6);ctx.stroke();ctx.strokeStyle='#e8fff1';ctx.lineWidth=2;ctx.stroke();ctx.restore();
        }
      }
    }
    const renderPath=(until,color,lineWidth)=>{ctx.strokeStyle=color;ctx.lineWidth=lineWidth;ctx.lineJoin='round';ctx.beginPath();let started=false;for(let i=0;i<points.length;i++){const p=points[i];if(p[0]>until)break;const [x,y]=project(p[1],p[2],zoom);if(!started||(i&&p[0]-points[i-1][0]>this.journey.maxInterpolationGapSeconds)){ctx.moveTo(x-ox,y-oy);started=true;}else ctx.lineTo(x-ox,y-oy);}ctx.stroke();};
    ctx.strokeStyle='#e3b674';ctx.lineWidth=1.4;ctx.setLineDash([4,4]);ctx.beginPath();for(let i=1;i<points.length;i++){if(points[i][0]-points[i-1][0]<=this.journey.maxInterpolationGapSeconds)continue;const a=project(points[i-1][1],points[i-1][2],zoom),b=project(points[i][1],points[i][2],zoom);ctx.moveTo(a[0]-ox,a[1]-oy);ctx.lineTo(b[0]-ox,b[1]-oy);}ctx.stroke();ctx.setLineDash([]);
    renderPath(Infinity,'#f1fae5',2);renderPath(this.time,'#306859',3);
    const [x,y]=project(current.longitude,current.latitude,zoom);
    ctx.fillStyle='#d4f76b';ctx.strokeStyle='#193a2a';ctx.lineWidth=2;ctx.beginPath();ctx.arc(x-ox,y-oy,5,0,Math.PI*2);ctx.fill();ctx.stroke();
  }
}
