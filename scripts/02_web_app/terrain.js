const TILE_ROOT='https://s3.amazonaws.com/elevation-tiles-prod/terrarium';
const SIZE=65;
const cache=new Map();
let failures=0;

function loadTile(level,x,y){
  const key=`${level}/${x}/${y}`;
  if(cache.has(key))return cache.get(key);
  const promise=fetch(`${TILE_ROOT}/${key}.png`).then(response=>{if(!response.ok)throw new Error('Terrain tile unavailable');return response.blob();}).then(createImageBitmap).then(bitmap=>{
    const canvas=document.createElement('canvas');canvas.width=bitmap.width;canvas.height=bitmap.height;
    const context=canvas.getContext('2d',{willReadFrequently:true});context.drawImage(bitmap,0,0);bitmap.close();
    return {width:canvas.width,height:canvas.height,data:context.getImageData(0,0,canvas.width,canvas.height).data};
  }).catch(error=>{cache.delete(key);failures++;throw error;});
  cache.set(key,promise);
  if(cache.size>96)cache.delete(cache.keys().next().value);
  return promise;
}

function decodeAt(tile,x,y){
  const xi=Math.max(0,Math.min(tile.width-1,Math.round(x))),yi=Math.max(0,Math.min(tile.height-1,Math.round(y)));
  const offset=(yi*tile.width+xi)*4,d=tile.data;
  return Math.max(0,d[offset]*256+d[offset+1]+d[offset+2]/256-32768);
}

export function createTerrainProvider(Cesium,onStatus){
  return new Cesium.CustomHeightmapTerrainProvider({width:SIZE,height:SIZE,tilingScheme:new Cesium.WebMercatorTilingScheme(),credit:new Cesium.Credit('Terrain © Mapzen, USGS, SRTM and others'),callback:(x,y,level)=>{
    const sourceLevel=Math.min(level,12),scale=2**(level-sourceLevel),sx=Math.floor(x/scale),sy=Math.floor(y/scale);
    return loadTile(sourceLevel,sx,sy).then(tile=>{
      const heights=new Float32Array(SIZE*SIZE);
      for(let row=0;row<SIZE;row++)for(let col=0;col<SIZE;col++){
        const px=((x/scale-sx)+col/(SIZE-1)/scale)*(tile.width-1);
        const py=((y/scale-sy)+row/(SIZE-1)/scale)*(tile.height-1);
        heights[row*SIZE+col]=decodeAt(tile,px,py);
      }
      return heights;
    }).catch(()=>{
      if(failures===1)onStatus('Some terrain tiles could not load; retrying as you move.');
      return new Float32Array(SIZE*SIZE);
    });
  }});
}
