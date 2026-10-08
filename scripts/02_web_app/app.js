import {sampleTrack,advancePlayback,validSegments,recordingGaps,clamp,radians,normalizeHeading} from './flight_math.mjs';
import {gapDetails,formatDuration} from './gap_details.mjs';
import {createTerrainProvider} from './terrain.js';
import {MiniMap} from './mini_map.js';
import {EnvironmentLayer} from './environment_layer.js';
import {individualsForSpecies,migrationsForIndividual} from './individual_catalog.mjs';
import {timeZoneAt,formatFlightTime,solarElevation,lightPhase} from './time_and_light.mjs';

const $=id=>document.getElementById(id);
const ui=Object.fromEntries(['rewindButton','fastForwardButton','directionSelect','individualSelect','jumpNoticesToggle','windToggle','precipitationToggle','temperatureToggle','weatherCard','weatherStatus','weatherReadings','weatherLegend','weatherCaption','mapHeading','loading','viewerError','viewerErrorText','speciesSelect','sourceBadge','flightStyle','resolutionNote','speedMetricLabel','gapCard','gapTitle','gapFrom','gapTo','gapExplanation','gapNightNote','gapCountdown','gapsButton','gapsDialog','gapsSummary','gapList','journeySelect','flightHeading','flightLocation','birdName','birdScientific','journeySummary','totalDistance','totalDuration','fixCount','fixInterval','flightDays','dayCount','currentDate','currentTime','timeBasis','timeContext','lightingButton','lightPhase','lightPreviewButton','lightPreviewPanel','lightPreviewTime','lightPreviewDate','lightPreviewPlayButton','lightPreviewTimeline','altitudeValue','speedValue','distanceValue','headingValue','compassNeedle','timeline','startLabel','endLabel','sampleStatus','mapProgress','altitudeChart','playButton','playLabel','playIcon','lookHint','terrainStatus','notice','sourcesDialog','sourceDetails'].map(id=>[id,$(id)]));
const state={journeys:[],journey:null,time:0,playing:false,multiplier:60,direction:1,mode:'first',lookYaw:0,lookPitch:0,frameTime:0,lastUi:0,lastNotice:0,currentDay:-1,overviewReady:false,cameraHeading:null,fov:67,timeBasis:'local',lighting:true,lightPreview:null,pendingGap:null,gaps:[],jumpNotices:true,environmentLayers:[]};
let viewer,C,marker,map,environment,routeEntities=[];
function savePreferences(){try{localStorage.setItem('migrationLensPreferences',JSON.stringify({jumpNotices:state.jumpNotices,environmentLayers:state.environmentLayers}));}catch{}}
function restorePreferences(){try{const saved=JSON.parse(localStorage.getItem('migrationLensPreferences')??'{}');state.jumpNotices=saved.jumpNotices!==false;state.environmentLayers=Array.isArray(saved.environmentLayers)?saved.environmentLayers.filter(layer=>['wind','precipitation','temperature'].includes(layer)):[];}catch{}}
const dateShort=new Intl.DateTimeFormat('en',{month:'short',day:'numeric',timeZone:'UTC'});
const number=new Intl.NumberFormat('en',{maximumFractionDigits:0});

function notice(message){ui.notice.textContent=message;ui.notice.hidden=false;state.lastNotice=performance.now();}
function setPlaying(value){
  state.playing=value;const backward=state.direction===-1;
  ui.playLabel.textContent=value?(backward?'Pause rewind':'Pause flight'):(backward?'Rewind flight':'Play flight');
  ui.playButton.setAttribute('aria-label',value?'Pause migration':(backward?'Play migration backward':'Play migration'));
  ui.playIcon.innerHTML=value?'<path d="M7 5h3v14H7zM14 5h3v14h-3z"/>':(backward?'<path d="M15 5L5 12l10 7z"/>':'<path d="M9 5l10 7-10 7z"/>');
}
function setPlaybackDirection(direction){
  state.direction=direction;ui.directionSelect.value=String(direction);clearGap();setPlaying(state.playing);
}
function togglePlayback(){
  stopLightPreview();
  const points=state.journey.points;
  if(!state.playing&&state.direction===1&&state.time>=points.at(-1)[0])state.time=points[0][0];
  if(!state.playing&&state.direction===-1&&state.time<=points[0][0])state.time=points.at(-1)[0];
  setPlaying(!state.playing);
}
function stepPlayback(direction){
  stopLightPreview();clearGap();const previous=state.time;
  const result=advancePlayback(state.journey,state.time,600,1,{direction});
  state.time=result.time;state.cameraHeading=null;
  if(state.playing&&(state.direction===1?state.time>=state.journey.points.at(-1)[0]:state.time<=state.journey.points[0][0]))setPlaying(false);
  if(result.skipped&&state.jumpNotices){
    const gaps=state.gaps.filter(gap=>gap.start<Math.max(previous,state.time)&&gap.end>Math.min(previous,state.time));
    const duration=gaps.reduce((sum,gap)=>sum+gap.duration,0);
    notice(`Skipped ${gaps.length} GPS ${gaps.length===1?'gap':'gaps'} while moving ${direction===1?'ahead':'back'} · ${formatDuration(duration)} without displayed positions`);
  }
  updateUi(true);updateCamera(1);
}

function failure(message){ui.loading.hidden=true;ui.viewerError.hidden=false;ui.viewerErrorText.textContent=message;setPlaying(false);}

function clearGap(){state.pendingGap=null;ui.gapCard.hidden=true;}
function showGap(gap){
  state.pendingGap={...gap,remaining:3,direction:state.direction};ui.gapCard.hidden=false;updateGapCard();
}
function updateGapCard(){
  if(!state.pendingGap)return;
  const details=gapDetails(state.journey,state.pendingGap,state.timeBasis);
  ui.gapTitle.textContent=`No displayed GPS fixes for ${details.duration}`;
  ui.gapFrom.textContent=details.from;ui.gapTo.textContent=details.to;
  ui.gapExplanation.textContent=details.explanation;ui.gapNightNote.textContent=details.nightNote;
  ui.gapCountdown.textContent=state.playing?`Jump ${state.pendingGap.direction===-1?'back ':''}in ${Math.ceil(state.pendingGap.remaining)}s`:'Position held · playback paused';
  $('pauseGapButton').hidden=!state.playing;$('skipGapButton').textContent=state.pendingGap.direction===-1?'Jump to previous fix':'Jump to next fix';
}
function finishGap(){
  if(!state.pendingGap)return;
  const duration=formatDuration(state.pendingGap.duration),backward=state.pendingGap.direction===-1;state.time=backward?state.pendingGap.start:state.pendingGap.end;clearGap();state.cameraHeading=null;
  if(state.jumpNotices)notice(`Jumped to the ${backward?'previous':'next'} GPS fix · ${duration} without displayed positions`);updateUi(true);updateCamera(1);
}
function inspectGap(index){
  const gap=state.gaps[index];if(!gap)return;
  stopLightPreview();setPlaying(false);state.time=state.direction===-1?gap.end:gap.start;state.cameraHeading=null;showGap(gap);updateUi(true);updateCamera(1);
}
function gapInside(time){return state.gaps.find(gap=>time>gap.start&&time<gap.end);}
function renderGapList(){
  ui.gapList.replaceChildren(...state.gaps.map((gap,index)=>{
    const details=gapDetails(state.journey,gap,state.timeBasis),row=document.createElement('button');
    row.className='gap-row';row.setAttribute('aria-label',`Inspect gap ${index+1}, ${details.duration}`);
    const title=document.createElement('strong');title.textContent=`${String(index+1).padStart(2,'0')} · ${details.duration}`;
    const times=document.createElement('span');times.textContent=`${details.from} → ${details.to}`;
    row.append(title,times);row.addEventListener('click',()=>{ui.gapsDialog.close();inspectGap(index);});return row;
  }));
}
function populateIndividuals(species,selected){
  const entries=individualsForSpecies(state.journeys,species);
  ui.individualSelect.replaceChildren(...entries.map(({individual,migrations})=>{
    const option=document.createElement('option');option.value=individual;
    option.textContent=`${individual}${migrations.length>1?` · ${migrations.length} migrations`:''}`;return option;
  }));
  if(entries.some(entry=>entry.individual===selected))ui.individualSelect.value=selected;
}
function populateJourneys(species,individual){
  const entries=migrationsForIndividual(state.journeys,species,individual);
  ui.journeySelect.replaceChildren(...entries.map(j=>{
    const option=document.createElement('option');option.value=j.id;
    option.textContent=`${new Date(j.points[0][0]*1000).getUTCFullYear()} · ${j.title.split(' · ').slice(1).join(' · ')}`;return option;
  }));
}
function setJumpNotices(enabled){
  state.jumpNotices=enabled;ui.jumpNoticesToggle.checked=enabled;
  if(!enabled){ui.notice.hidden=true;if(state.pendingGap&&state.playing)finishGap();else clearGap();}
  savePreferences();
}
function setEnvironmentLayers(layers){
  state.environmentLayers=layers;
  for(const layer of ['wind','precipitation','temperature'])ui[`${layer}Toggle`].checked=layers.includes(layer);
  environment.setLayers(layers);savePreferences();updateEnvironment();if(state.journey)map.update(state.time);
}
function updateEnvironment(){
  if(!state.journey||!environment)return;
  const enabled=state.environmentLayers.length>0;ui.weatherCard.hidden=!enabled;
  ui.weatherCaption.textContent=`Surface estimates · 1° display samples${state.environmentLayers.includes('wind')?'\nArrows point where wind blows':''}`;
  document.querySelector('.flight-stage').classList.toggle('has-weather',enabled);
  ui.mapHeading.textContent=enabled?'WEATHER NEAR THE BIRD':'THE JOURNEY';
  const position=sampleTrack(state.journey,state.time);
  map.setEnvironment(environment.data,state.environmentLayers);
  if(!enabled){ui.weatherLegend.replaceChildren();return;}
  if(!environment.data){
    ui.weatherStatus.textContent=environment.error?'Weather could not load. Clear layers and retry.':'Loading historical weather…';
    ui.weatherReadings.replaceChildren();ui.weatherLegend.replaceChildren();return;
  }
  const reading=environment.sample(state.time,position.longitude,position.latitude);
  environment.update(state.time,position);
  if(!reading){ui.weatherStatus.textContent='No weather samples at this position and time.';ui.weatherReadings.replaceChildren();return;}
  const clock=formatFlightTime(reading.time,timeZoneAt(state.journey,position));
  ui.weatherStatus.textContent=`${state.timeBasis==='utc'?clock.utcTime+' UTC':clock.time+' local'} · hourly snapshot${gapInside(state.time)||state.pendingGap?' · held GPS fix':''}${state.lightPreview?' · flight time held':''}`;
  const rows=[];
  if(state.environmentLayers.includes('wind'))rows.push(['Wind',reading.wind?(reading.wind.speed<.15?'Calm · <0.5 km/h':`${(reading.wind.speed*3.6).toFixed(1)} km/h · from ${reading.wind.cardinal} (${Math.round(reading.wind.from)}°)`):'Unavailable']);
  if(state.environmentLayers.includes('precipitation'))rows.push(['Precipitation',reading.precipitation==null?'Unavailable':`${reading.precipitation.toFixed(2)} mm · preceding hour`]);
  if(state.environmentLayers.includes('temperature'))rows.push(['Temperature',reading.temperature==null?'Unavailable':`${reading.temperature.toFixed(1)} °C · at 2 m`]);
  ui.weatherReadings.replaceChildren(...rows.map(([name,value])=>{const row=document.createElement('div');row.className='weather-reading';const label=document.createElement('span');label.textContent=name;const metric=document.createElement('b');metric.textContent=value;row.append(label,metric);return row;}));
  ui.weatherLegend.replaceChildren(...state.environmentLayers.map(layer=>{const row=document.createElement('div');row.className=`weather-scale ${layer}`;const swatch=document.createElement('i');const label=document.createElement('span');label.textContent=layer==='temperature'?'−15 → 45 °C':layer==='precipitation'?'Blue intensity: 0 → 5+ mm':'Longer arrows: stronger wind';row.append(swatch,label);return row;}));
}

function setLighting(enabled){
  state.lighting=enabled;
  viewer.scene.globe.enableLighting=enabled;
  viewer.scene.globe.dynamicAtmosphereLighting=true;
  viewer.scene.globe.dynamicAtmosphereLightingFromSun=true;
  viewer.scene.atmosphere.dynamicLighting=enabled?C.DynamicAtmosphereLightingType.SUNLIGHT:C.DynamicAtmosphereLightingType.NONE;
  if(viewer.scene.sun)viewer.scene.sun.show=enabled;
  if(viewer.scene.moon)viewer.scene.moon.show=enabled;
  ui.lightingButton.textContent=enabled?'Day/night on':'Daylight view';
  ui.lightingButton.setAttribute('aria-pressed',String(enabled));
  viewer.scene.requestRender();
}

function setLightPreviewPlaying(playing){
  if(!state.lightPreview)return;
  state.lightPreview.playing=playing;
  ui.lightPreviewPlayButton.textContent=playing?'Pause':'Play';
  ui.lightPreviewPlayButton.setAttribute('aria-label',playing?'Pause lighting preview':'Play lighting preview');
}

function startLightPreview(minutes=0,playing=true){
  clearGap();setPlaying(false);setLighting(true);
  const sample=sampleTrack(state.journey,state.time);
  state.lightPreview={anchor:state.time,minutes,sample,zone:timeZoneAt(state.journey,sample),playing};
  ui.lightPreviewPanel.hidden=false;ui.lightPreviewButton.setAttribute('aria-pressed','true');
  document.querySelector('.flight-stage').classList.add('lighting-preview');
  setLightPreviewPlaying(playing);updateLighting();
}

function stopLightPreview(){
  state.lightPreview=null;ui.lightPreviewPanel.hidden=true;ui.lightPreviewButton.setAttribute('aria-pressed','false');
  document.querySelector('.flight-stage').classList.remove('lighting-preview');
  if(viewer&&state.journey)updateLighting();
}

function updateLighting(){
  if(!viewer||!state.journey)return;
  const preview=state.lightPreview;
  const sample=preview?.sample??sampleTrack(state.journey,state.time);
  const timestamp=preview?preview.anchor+preview.minutes*60:state.time;
  viewer.clock.currentTime=C.JulianDate.fromDate(new Date(timestamp*1000),viewer.clock.currentTime);
  const elevation=solarElevation(timestamp,sample.longitude,sample.latitude),phase=lightPhase(elevation);
  ui.lightPhase.textContent=state.lighting?phase.name:'Always bright';ui.lightPhase.dataset.kind=state.lighting?phase.kind:'day';
  ui.lightPhase.title=`Sun ${elevation.toFixed(1)}° above an unobstructed ground horizon${preview?' · lighting preview at held position':''}`;
  if(preview){
    const local=formatFlightTime(timestamp,preview.zone);
    ui.lightPreviewTime.textContent=`${local.time} local`;ui.lightPreviewDate.textContent=`${local.date} · ${local.offset}`;
    ui.lightPreviewTimeline.value=Math.round(preview.minutes);
  }
  viewer.scene.requestRender();
}
function setMode(mode){
  if(!viewer)return;
  state.mode=mode;state.overviewReady=false;state.cameraHeading=null;
  for(const [id,value] of [['firstPersonButton','first'],['followButton','follow'],['overviewButton','overview']]){const active=mode===value;$(id).classList.toggle('active',active);$(id).setAttribute('aria-pressed',String(active));}
  const controller=viewer.scene.screenSpaceCameraController;
  controller.enableInputs=mode==='overview';
  ui.lookHint.hidden=mode==='overview';
  marker.show=mode!=='first';
  for(const entity of routeEntities)entity.show=mode!=='first';
  if(mode==='overview'){
    const points=state.journey.points;
    const west=Math.min(...points.map(p=>p[1])),east=Math.max(...points.map(p=>p[1])),south=Math.min(...points.map(p=>p[2])),north=Math.max(...points.map(p=>p[2]));
    viewer.camera.setView({destination:C.Rectangle.fromDegrees(west-1,south-1,east+1,north+1)});
    state.overviewReady=true;
  }
  viewer.scene.requestRender();
}

function chooseJourney(id){
  const journey=state.journeys.find(j=>j.id===id);if(!journey)return;
  stopLightPreview();clearGap();
  setPlaying(false);state.journey=journey;state.currentDay=-1;state.time=journey.points[journey.previewIndex][0];state.lookYaw=0;state.lookPitch=0;state.cameraHeading=null;
  ui.speciesSelect.value=journey.species;populateIndividuals(journey.species,journey.individual);
  populateJourneys(journey.species,journey.individual);ui.journeySelect.value=id;
  ui.sourceBadge.textContent=journey.sourceLabel??'Movebank archive';ui.flightStyle.textContent=journey.flightStyle??'SOARING MIGRANT';
  ui.resolutionNote.textContent=journey.resolutionNote??'Measured GPS track · approximate GPS altitude';
  state.gaps=recordingGaps(journey);ui.gapsButton.textContent=`Recording gaps (${state.gaps.length})`;
  ui.gapsSummary.textContent=`Intervals longer than ${formatDuration(journey.maxInterpolationGapSeconds)} are marked on the timeline and skipped; visible notices are optional. Gaps refer to the displayed selection; the source archive may contain other observations.`;
  renderGapList();
  ui.journeySelect.value=id;ui.flightHeading.textContent=journey.subtitle;ui.flightLocation.textContent=`${journey.individual} · ${journey.species} · ${new Date(journey.points[0][0]*1000).getUTCFullYear()}`;
  ui.birdName.textContent=journey.species;ui.birdScientific.textContent=journey.scientificName;ui.journeySummary.textContent=journey.description;
  ui.totalDistance.textContent=`${number.format(journey.totalDistanceKm)} km`;ui.totalDuration.textContent=`${journey.durationDays} ${journey.durationDays===1?'day':'days'}`;ui.fixCount.textContent=number.format(journey.points.length);ui.fixInterval.textContent=journey.medianIntervalSeconds<120?`${journey.medianIntervalSeconds} sec`:formatDuration(journey.medianIntervalSeconds);
  ui.dayCount.textContent=`${journey.days.length} recorded days`;
  ui.startLabel.textContent=dateShort.format(new Date(journey.days[0].date+'T12:00:00Z'));ui.endLabel.textContent=dateShort.format(new Date(journey.days.at(-1).date+'T12:00:00Z'));
  ui.flightDays.replaceChildren(...journey.days.map((day,i)=>{const button=document.createElement('button');button.className='day-button';button.dataset.index=i;button.setAttribute('aria-label',`Fly day ${i+1}, ${day.date}`);button.innerHTML=`<span class="day-number">${String(i+1).padStart(2,'0')}</span><span class="day-text">${dateShort.format(new Date(day.date+'T12:00:00Z'))}<small>${number.format(day.fixes)} GPS fixes</small></span><span class="day-distance">${number.format(day.distanceKm)} km</span>`;button.addEventListener('click',()=>seekDay(i));return button;}));
  ui.sourceDetails.replaceChildren();
  const dl=document.createElement('dl');
  for(const [key,value] of [['Bird',journey.individual],['Archive study',journey.studyId],['GPS interval',`${journey.medianIntervalSeconds} seconds (median of retained fixes)`],['Altitude',journey.altitudeDatum],['Distance',journey.distanceDefinition],['Reuse',journey.licence]]){const dt=document.createElement('dt');dt.textContent=key;const dd=document.createElement('dd');dd.textContent=value;dl.append(dt,dd);}
  ui.sourceDetails.append(dl);
  const source=document.createElement('p');source.textContent=journey.citation+' ';const link=document.createElement('a');link.href=journey.sourceDoi;link.textContent='Open tracking archive';link.target='_blank';link.rel='noopener';source.append(link);ui.sourceDetails.append(source);
  if(journey.publication){const paper=document.createElement('p');const paperLink=document.createElement('a');paperLink.href=journey.publication;paperLink.textContent=journey.publicationTitle??'Related research: weather and migration stopovers';paperLink.target='_blank';paperLink.rel='noopener';paper.append(paperLink);if(journey.individual==='Peter'||journey.individual==='Steve')paper.append(document.createTextNode(' — this paper analysed earlier migrations (2006–2019), rather than this individual’s 2021 flight.'));ui.sourceDetails.append(paper);}
  const method=document.createElement('p');method.textContent='Selection: '+journey.curation;ui.sourceDetails.append(method);
  for(const entity of routeEntities)viewer.entities.remove(entity);routeEntities=[];
  for(const segment of validSegments(journey)){
    const positions=segment.map(p=>C.Cartesian3.fromDegrees(p[1],p[2],p[3]==null?0:p[3]+60));
    routeEntities.push(viewer.entities.add({polyline:{positions,width:2,clampToGround:journey.altitudeField===null,material:C.Color.fromCssColorString('#d4f76b').withAlpha(.75),arcType:journey.altitudeField===null?C.ArcType.GEODESIC:C.ArcType.NONE}}));
  }
  environment.setJourney(journey);map.setJourney(journey);drawChart();setMode(journey.recommendedMode??'first');updateUi(true);updateCamera(1);
  const url=new URL(location.href);url.searchParams.set('journey',id);history.replaceState(null,'',url);
}

function seekDay(index){stopLightPreview();clearGap();const days=state.journey.days,indexSafe=clamp(index,0,days.length-1);state.time=state.journey.points[days[indexSafe].startIndex][0];state.cameraHeading=null;updateUi(true);updateCamera(1);}
function activeDay(){const j=state.journey,sample=sampleTrack(j,state.time);return Math.max(0,j.days.findIndex(day=>sample.index>=day.startIndex&&sample.index<=day.endIndex));}
function updateUi(force=false){
  if(!state.journey)return;
  const sample=sampleTrack(state.journey,state.time),j=state.journey,zone=timeZoneAt(j,sample),clock=formatFlightTime(sample.time,zone);
  const local=state.timeBasis==='local';
  ui.currentDate.textContent=local?clock.date:clock.utcDate;ui.currentTime.textContent=local?clock.time:clock.utcTime;
  ui.timeContext.textContent=local?`${clock.offset} · ${clock.utcTime} UTC`:`${clock.time} local · ${clock.offset}`;
  ui.timeContext.title=`Bird local zone: ${zone}. Local: ${clock.date}, ${clock.time}; UTC: ${clock.utcDate}, ${clock.utcTime}. Zone from nearest recorded fix.`;
  const missing=gapInside(state.time);
  ui.altitudeValue.innerHTML=sample.altitude==null?'— <small>not recorded</small>':`${number.format(sample.altitude)} <small>m*</small>`;
  ui.speedMetricLabel.textContent=sample.speedMeasured?'Ground speed':'Est. segment speed';
  ui.speedValue.innerHTML=missing||sample.gap?'—':`${sample.speedMeasured?'':'≈ '}${number.format(sample.speed*3.6)} <small>km/h</small>`;
  ui.distanceValue.innerHTML=`${number.format(sample.distance)} <small>km</small>`;
  ui.headingValue.textContent=`${number.format(sample.heading)}°`;ui.compassNeedle.style.transform=`rotate(${normalizeHeading(sample.heading+state.lookYaw)}deg)`;
  ui.timeline.value=Math.round((sample.time-j.points[0][0])/(j.points.at(-1)[0]-j.points[0][0])*1000);
  ui.sampleStatus.textContent=missing?`No GPS fixes · position held · ${formatDuration(sample.interval)} gap`:`${(sample.fraction<.01||sample.fraction>.99)?'Recorded GPS fix':'Between GPS fixes'} · ${formatDuration(sample.interval)} spacing${sample.altitude==null?' · viewing height illustrative':' · * approximate GPS height'}`;
  ui.rewindButton.disabled=state.time<=j.points[0][0];ui.fastForwardButton.disabled=state.time>=j.points.at(-1)[0];
  updateGapCard();
  $('streetViewLink').href=`https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${sample.latitude.toFixed(5)},${sample.longitude.toFixed(5)}`;
  ui.mapProgress.textContent=`${Math.round(sample.distance/j.totalDistanceKm*100)}% of observed route`;
  const day=activeDay();if(day!==state.currentDay||force){state.currentDay=day;[...ui.flightDays.children].forEach((button,i)=>{button.classList.toggle('active',i===day);button.setAttribute('aria-current',i===day?'true':'false');});}
  updateEnvironment();map.update(state.time);
  updateLighting();
}

function drawChart(){
  const canvas=ui.altitudeChart,w=canvas.clientWidth,h=canvas.clientHeight,dpr=Math.min(devicePixelRatio,2);
  if(!w||!h||!state.journey)return;canvas.width=w*dpr;canvas.height=h*dpr;const ctx=canvas.getContext('2d');ctx.scale(dpr,dpr);ctx.clearRect(0,0,w,h);
  const j=state.journey,start=j.points[0][0],duration=j.points.at(-1)[0]-start,max=Math.max(...j.points.map(p=>p[3]),1);
  for(const gap of state.gaps){
    const left=(gap.start-start)/duration*w,right=(gap.end-start)/duration*w;
    ctx.save();ctx.beginPath();ctx.rect(left,0,right-left,h);ctx.clip();ctx.fillStyle='#bc8c3933';ctx.fillRect(left,0,right-left,h);
    ctx.strokeStyle='#c4a26788';ctx.lineWidth=1;ctx.beginPath();for(let x=left-h;x<right;x+=7){ctx.moveTo(x,h);ctx.lineTo(x+h,0);}ctx.stroke();ctx.restore();
  }
  ctx.strokeStyle='#8cae5e';ctx.lineWidth=1;ctx.beginPath();let connected=false;
  j.points.forEach((p,i)=>{
    if(p[3]==null){connected=false;return;}
    const x=(p[0]-start)/duration*w,y=h-2-(p[3]/max)*(h-4);
    if(!connected||p[0]-j.points[i-1][0]>j.maxInterpolationGapSeconds)ctx.moveTo(x,y);else ctx.lineTo(x,y);connected=true;
  });ctx.stroke();
  canvas.setAttribute('aria-label',j.altitudeField===null?'Timeline with recording gaps; altitude unavailable':'Recorded altitude and hatched recording gaps over the migration');
}

function updateCamera(dt){
  if(!viewer||!state.journey)return;
  const sample=sampleTrack(state.journey,state.time),cartographic=C.Cartographic.fromDegrees(sample.longitude,sample.latitude);
  const ground=viewer.scene.globe.getHeight(cartographic);
  const groundHeight=Number.isFinite(ground)?ground:0;
  const height=sample.altitude==null?groundHeight+(state.journey.defaultCameraHeightM??750):Math.max(sample.altitude,groundHeight+35,25);
  const position=C.Cartesian3.fromDegrees(sample.longitude,sample.latitude,height);
  marker.position=position;
  if(state.mode==='overview'){viewer.scene.requestRender();return;}
  if(state.cameraHeading==null)state.cameraHeading=sample.heading;
  const delta=((sample.heading-state.cameraHeading+540)%360)-180;
  state.cameraHeading=normalizeHeading(state.cameraHeading+delta*(1-Math.exp(-Math.min(dt,.3)*5)));
  if(state.mode==='first'){
    viewer.camera.setView({destination:position,orientation:{heading:radians(state.cameraHeading+state.lookYaw),pitch:radians(clamp(-12+state.lookPitch,-85,65)),roll:0}});
  }else{
    const transform=C.Transforms.eastNorthUpToFixedFrame(position);
    viewer.camera.lookAtTransform(transform,new C.HeadingPitchRange(radians(state.cameraHeading+state.lookYaw),radians(clamp(-24+state.lookPitch,-85,-3)),950));
    viewer.camera.lookAtTransform(C.Matrix4.IDENTITY);
  }
  if(viewer.camera.frustum.fov!==undefined)viewer.camera.frustum.fov=radians(state.fov);
  viewer.scene.requestRender();
}

function animationFrame(now){
  const dt=state.frameTime?Math.min((now-state.frameTime)/1000,.25):0;state.frameTime=now;
  if(state.lightPreview?.playing){state.lightPreview.minutes+=dt*30;if(state.lightPreview.minutes>=1440){state.lightPreview.minutes=1440;setLightPreviewPlaying(false);}updateLighting();}
  if(state.playing){
    if(state.pendingGap){state.pendingGap.remaining-=dt;if(state.pendingGap.remaining<=0)finishGap();}
    else{const result=advancePlayback(state.journey,state.time,dt,state.multiplier,{stopAtGap:state.jumpNotices,direction:state.direction});state.time=result.time;if(result.gap)showGap(result.gap);if(result.ended)setPlaying(false);}
  }
  if(viewer&&state.journey&&state.mode!=='overview'&&(state.playing||now-state.lastUi>180))updateCamera(dt);
  if(now-state.lastUi>180){updateUi();state.lastUi=now;}
  if(!ui.notice.hidden&&now-state.lastNotice>3300)ui.notice.hidden=true;
  requestAnimationFrame(animationFrame);
}

function bindControls(){
  $('firstPersonButton').addEventListener('click',()=>setMode('first'));$('followButton').addEventListener('click',()=>setMode('follow'));$('overviewButton').addEventListener('click',()=>setMode('overview'));
  $('mapExpandButton').addEventListener('click',()=>setMode('overview'));
  ui.speciesSelect.addEventListener('change',event=>chooseJourney(state.journeys.find(j=>j.species===event.target.value).id));
  ui.individualSelect.addEventListener('change',event=>chooseJourney(migrationsForIndividual(state.journeys,ui.speciesSelect.value,event.target.value)[0].id));
  ui.jumpNoticesToggle.addEventListener('change',event=>setJumpNotices(event.target.checked));
  for(const layer of ['wind','precipitation','temperature'])ui[`${layer}Toggle`].addEventListener('change',()=>setEnvironmentLayers(['wind','precipitation','temperature'].filter(name=>ui[`${name}Toggle`].checked)));
  $('clearEnvironmentButton').addEventListener('click',()=>{environment.error=false;setEnvironmentLayers([]);});
  $('skipGapButton').addEventListener('click',finishGap);$('pauseGapButton').addEventListener('click',()=>{setPlaying(false);updateGapCard();});
  ui.gapsButton.addEventListener('click',()=>{setPlaying(false);renderGapList();ui.gapsDialog.showModal();});$('closeGapsButton').addEventListener('click',()=>ui.gapsDialog.close());
  ui.journeySelect.addEventListener('change',event=>chooseJourney(event.target.value));
  ui.playButton.addEventListener('click',togglePlayback);
  ui.rewindButton.addEventListener('click',()=>stepPlayback(-1));ui.fastForwardButton.addEventListener('click',()=>stepPlayback(1));
  ui.directionSelect.addEventListener('change',event=>setPlaybackDirection(Number(event.target.value)));
  $('previousDayButton').addEventListener('click',()=>seekDay(activeDay()-1));$('nextDayButton').addEventListener('click',()=>seekDay(activeDay()+1));
  $('speedSelect').addEventListener('change',event=>state.multiplier=Number(event.target.value));
  ui.timeline.addEventListener('input',event=>{stopLightPreview();clearGap();const p=state.journey.points;state.time=p[0][0]+Number(event.target.value)/1000*(p.at(-1)[0]-p[0][0]);state.cameraHeading=null;const gap=gapInside(state.time);if(gap&&state.jumpNotices)showGap(gap);updateUi(true);updateCamera(1);});
  ui.timeBasis.addEventListener('change',event=>{state.timeBasis=event.target.value;updateUi(true);});
  ui.lightingButton.addEventListener('click',()=>{if(state.lightPreview)stopLightPreview();setLighting(!state.lighting);updateLighting();});
  ui.lightPreviewButton.addEventListener('click',()=>state.lightPreview?stopLightPreview():startLightPreview());
  $('closeLightPreviewButton').addEventListener('click',stopLightPreview);
  ui.lightPreviewPlayButton.addEventListener('click',()=>{if(state.lightPreview.minutes>=1440)state.lightPreview.minutes=0;setLightPreviewPlaying(!state.lightPreview.playing);});
  ui.lightPreviewTimeline.addEventListener('input',event=>{state.lightPreview.minutes=Number(event.target.value);setLightPreviewPlaying(false);updateLighting();});
  $('resetLookButton').addEventListener('click',()=>{state.lookYaw=0;state.lookPitch=0;state.fov=67;updateCamera(1);});
  $('sourcesButton').addEventListener('click',()=>{setPlaying(false);ui.sourcesDialog.showModal();});$('closeSourcesButton').addEventListener('click',()=>ui.sourcesDialog.close());
  ui.sourcesDialog.addEventListener('click',event=>{if(event.target===ui.sourcesDialog){const r=ui.sourcesDialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)ui.sourcesDialog.close();}});
  $('retryButton').addEventListener('click',()=>location.reload());
  $('fullscreenButton').addEventListener('click',async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await $('app').requestFullscreen();}catch{notice('Fullscreen is unavailable in this browser.');}});
  document.addEventListener('keydown',event=>{if(!state.journey||ui.sourcesDialog.open||ui.gapsDialog.open||['INPUT','SELECT','TEXTAREA','BUTTON'].includes(event.target.tagName))return;if(event.code==='Space'){event.preventDefault();togglePlayback();}else if(event.key==='['||event.key===']'){event.preventDefault();stepPlayback(event.key==='['?-1:1);}else if(['ArrowLeft','ArrowRight'].includes(event.key)){event.preventDefault();state.lookYaw+=event.key==='ArrowLeft'?-8:8;}else if(['ArrowUp','ArrowDown'].includes(event.key)){event.preventDefault();state.lookPitch=clamp(state.lookPitch+(event.key==='ArrowUp'?5:-5),-65,85);}else if(event.key.toLowerCase()==='r'){state.lookYaw=0;state.lookPitch=0;}});
  const canvas=viewer.scene.canvas;let dragging=false,lastX=0,lastY=0;
  canvas.addEventListener('pointerdown',event=>{if(state.mode==='overview')return;dragging=true;lastX=event.clientX;lastY=event.clientY;canvas.setPointerCapture(event.pointerId);canvas.style.cursor='grabbing';});
  canvas.addEventListener('pointermove',event=>{if(!dragging)return;state.lookYaw-=(event.clientX-lastX)*.22;state.lookPitch=clamp(state.lookPitch+(event.clientY-lastY)*.18,-65,85);lastX=event.clientX;lastY=event.clientY;updateCamera(.2);});
  const endDrag=()=>{dragging=false;canvas.style.cursor='grab';};canvas.addEventListener('pointerup',endDrag);canvas.addEventListener('pointercancel',endDrag);
  canvas.addEventListener('wheel',event=>{if(state.mode==='overview')return;event.preventDefault();state.fov=clamp(state.fov+Math.sign(event.deltaY)*3,30,95);},{passive:false});canvas.style.cursor='grab';canvas.style.touchAction='none';
  new ResizeObserver(drawChart).observe(ui.altitudeChart);
}

async function registerTools(){
  const context=document.modelContext;
  if(!context?.registerTool)return;
  const lifecycle=new AbortController();
  window.addEventListener('pagehide',()=>lifecycle.abort(),{once:true});
  await context.registerTool({name:'configure_migration_playback',title:'Configure migration playback',description:'Select a tracked migration, flight day, forward/backward playback or a ten-minute step, camera, local/UTC clock, surface weather overlays, jump notices and flight-time/daylight lighting. Preview 24 hours of sunlight at a held track position without changing bird movement. Changes the visible viewer only.',inputSchema:{type:'object',properties:{journey:{type:'string',enum:state.journeys.map(j=>j.id)},day:{type:'integer',minimum:1},gap:{type:'integer',minimum:1,description:'Inspect a numbered recording gap; holds at the entry fix in the selected playback direction.'},camera:{type:'string',enum:['first','follow','overview']},playing:{type:'boolean'},direction:{type:'string',enum:['forward','backward']},stepMinutes:{type:'number',enum:[-10,10],description:'Step by ten recorded minutes; skips gaps in the chosen direction.'},clock:{type:'string',enum:['local','utc']},lighting:{type:'string',enum:['flight','daylight']},lightPreviewMinutes:{type:'number',minimum:0,maximum:1440},lightPreviewPlaying:{type:'boolean'},jumpNotices:{type:'boolean'},environment:{type:'array',items:{type:'string',enum:['wind','precipitation','temperature']},uniqueItems:true}},additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:false},execute:async(input)=>{
    if(!input||typeof input!=='object'||Array.isArray(input))throw new Error('Expected playback options.');
    const {journey,day,gap,camera,playing,direction,stepMinutes,clock,lighting,lightPreviewMinutes,lightPreviewPlaying,jumpNotices,environment:layers}=input;
    if(Object.keys(input).some(key=>!['journey','day','gap','camera','playing','direction','stepMinutes','clock','lighting','lightPreviewMinutes','lightPreviewPlaying','jumpNotices','environment'].includes(key)))throw new Error('Unknown playback option.');
    const selected=journey===undefined?state.journey:state.journeys.find(j=>j.id===journey);
    if(!selected)throw new Error('Unknown journey.');
    if(day!==undefined&&(!Number.isInteger(day)||day<1||day>selected.days.length))throw new Error('Flight day is outside the recorded journey.');
    if(gap!==undefined&&(!Number.isInteger(gap)||gap<1||gap>recordingGaps(selected).length||day!==undefined))throw new Error('Select a valid recording gap without a flight day.');
    if(camera!==undefined&&!['first','follow','overview'].includes(camera))throw new Error('Unknown camera view.');
    if(playing!==undefined&&typeof playing!=='boolean')throw new Error('Playing must be true or false.');
    if(direction!==undefined&&!['forward','backward'].includes(direction))throw new Error('Unknown playback direction.');
    if(stepMinutes!==undefined&&(![-10,10].includes(stepMinutes)||gap!==undefined))throw new Error('Select a ten-minute step without a recording-gap inspection.');
    if(clock!==undefined&&!['local','utc'].includes(clock))throw new Error('Unknown clock basis.');
    if(lighting!==undefined&&!['flight','daylight'].includes(lighting))throw new Error('Unknown lighting mode.');
    if(lightPreviewMinutes!==undefined&&(!Number.isFinite(lightPreviewMinutes)||lightPreviewMinutes<0||lightPreviewMinutes>1440))throw new Error('Lighting preview must be between 0 and 1440 minutes.');
    if(lightPreviewPlaying!==undefined&&typeof lightPreviewPlaying!=='boolean')throw new Error('Lighting preview playing must be true or false.');
    if(jumpNotices!==undefined&&typeof jumpNotices!=='boolean')throw new Error('Jump notices must be true or false.');
    if(layers!==undefined&&(!Array.isArray(layers)||layers.some(layer=>!['wind','precipitation','temperature'].includes(layer))||new Set(layers).size!==layers.length))throw new Error('Select valid environment layers.');
    const previewRequested=lightPreviewMinutes!==undefined||lightPreviewPlaying!==undefined;
    if(previewRequested&&(playing===true||lighting==='daylight'||stepMinutes!==undefined))throw new Error('Lighting preview holds position and requires day/night lighting.');
    if(journey!==undefined)chooseJourney(journey);if(direction)setPlaybackDirection(direction==='backward'?-1:1);if(day!==undefined)seekDay(day-1);if(gap!==undefined)inspectGap(gap-1);if(camera)setMode(camera);
    if(clock){state.timeBasis=clock;ui.timeBasis.value=clock;}
    if(lighting){stopLightPreview();setLighting(lighting==='flight');}
    if(typeof playing==='boolean'){if(playing)stopLightPreview();setPlaying(playing);}
    if(previewRequested){
      if(!state.lightPreview)startLightPreview(lightPreviewMinutes??0,lightPreviewPlaying??false);
      else{if(lightPreviewMinutes!==undefined){state.lightPreview.minutes=lightPreviewMinutes;setLightPreviewPlaying(false);}if(lightPreviewPlaying!==undefined)setLightPreviewPlaying(lightPreviewPlaying);}
    }
    if(jumpNotices!==undefined)setJumpNotices(jumpNotices);if(layers!==undefined)setEnvironmentLayers(layers);if(stepMinutes!==undefined)stepPlayback(Math.sign(stepMinutes));
    updateUi(true);updateCamera(1);
    return {direction:state.direction===-1?'backward':'forward',jumpNotices:state.jumpNotices,environment:state.environmentLayers,journey:state.journey.id,time:state.time,camera:state.mode,playing:state.playing,clock:state.timeBasis,lighting:state.lighting?'flight':'daylight',lightPreviewMinutes:state.lightPreview?.minutes??null};
  }},{signal:lifecycle.signal});
}

async function start(){
  try{
    const response=await fetch('data/journeys.json');if(!response.ok)throw new Error('The tracking archive could not be loaded.');const data=await response.json();state.journeys=data.journeys;
    if(!window.Cesium)throw new Error('The globe library could not load. Check your internet connection and try again.');
    C=window.Cesium;C.Ion.defaultAccessToken='';
    const imagery=new C.UrlTemplateImageryProvider({url:'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',maximumLevel:19,tilingScheme:new C.WebMercatorTilingScheme(),credit:new C.Credit('Imagery © Esri, Maxar, Earthstar Geographics and the GIS User Community')});
    viewer=new C.Viewer('globe',{baseLayer:new C.ImageryLayer(imagery),terrainProvider:createTerrainProvider(C,notice),animation:false,timeline:false,baseLayerPicker:false,geocoder:false,homeButton:false,sceneModePicker:false,navigationHelpButton:false,fullscreenButton:false,infoBox:false,selectionIndicator:false,requestRenderMode:true,maximumRenderTimeChange:Infinity,contextOptions:{webgl:{alpha:false,antialias:true,powerPreference:'high-performance'}}});
    viewer.resolutionScale=Math.min(devicePixelRatio,1.5)/devicePixelRatio;viewer.scene.globe.maximumScreenSpaceError=2.5;viewer.scene.globe.tileCacheSize=120;viewer.scene.globe.depthTestAgainstTerrain=true;viewer.scene.globe.baseColor=C.Color.fromCssColorString('#547a77');viewer.scene.fog.density=.00005;
    viewer.clock.shouldAnimate=false;setLighting(true);
    // Keep sunlight shading active at bird flight height.
    viewer.scene.globe.lightingFadeOutDistance=0;viewer.scene.globe.lightingFadeInDistance=1;
    viewer.scene.globe.nightFadeOutDistance=0;viewer.scene.globe.nightFadeInDistance=1;
    if(viewer.scene.skyAtmosphere)viewer.scene.skyAtmosphere.hueShift=-.04;
    marker=viewer.entities.add({point:{pixelSize:12,color:C.Color.fromCssColorString('#d4f76b'),outlineColor:C.Color.fromCssColorString('#0e251c'),outlineWidth:2,disableDepthTestDistance:Number.POSITIVE_INFINITY}});
    viewer.scene.renderError.addEventListener((_scene,error)=>failure('The 3D scene encountered a graphics problem. Reload the page or try a browser with hardware acceleration.'));
    imagery.errorEvent.addEventListener(()=>{ui.terrainStatus.textContent='Imagery coverage varies · 3D terrain';});
    map=new MiniMap($('miniMap'));environment=new EnvironmentLayer(viewer,C,()=>updateEnvironment());
    ui.speciesSelect.replaceChildren(...[...new Set(state.journeys.map(j=>j.species))].map(species=>{const option=document.createElement('option');option.value=species;option.textContent=species;return option;}));
    restorePreferences();ui.jumpNoticesToggle.checked=state.jumpNotices;setEnvironmentLayers(state.environmentLayers);
    bindControls();const selected=new URL(location.href).searchParams.get('journey');chooseJourney(state.journeys.some(j=>j.id===selected)?selected:state.journeys[0].id);
    viewer.scene.globe.tileLoadProgressEvent.addEventListener(remaining=>{if(remaining===0&&viewer.scene.globe.tilesLoaded)ui.loading.hidden=true;});
    setTimeout(()=>{ui.loading.hidden=true;},12000);
    requestAnimationFrame(animationFrame);registerTools().catch(()=>{});
  }catch(error){failure(error.message||'The flight could not be opened. Please try again.');}
}
start();
