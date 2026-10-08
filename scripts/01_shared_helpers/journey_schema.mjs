export function validateJourneys(journeys) {
  const ids=new Set();
  for(const journey of journeys){
    if(!journey.id||ids.has(journey.id))throw new Error('Journey IDs must be present and unique.');
    ids.add(journey.id);
    for(const field of ['individual','species','scientificName','sourceDoi','citation','licence','altitudeDatum']){
      if(typeof journey[field]!=='string'||!journey[field])throw new Error(`${journey.id}: ${field} is required.`);
    }
    if(!Number.isFinite(journey.maxInterpolationGapSeconds)||journey.maxInterpolationGapSeconds<=0)throw new Error(`${journey.id}: invalid interpolation limit.`);
    if(!journey.points||journey.points.length<2)throw new Error(`${journey.id}: at least two observations required.`);
    journey.points.forEach((point,index)=>{
      if(!point.slice(0,3).every(Number.isFinite)||Math.abs(point[1])>180||Math.abs(point[2])>90)throw new Error(`${journey.id}: invalid coordinates.`);
      if(index&&point[0]<=journey.points[index-1][0])throw new Error(`${journey.id}: timestamps must increase.`);
      if(point[3]!==null&&!Number.isFinite(point[3]))throw new Error(`${journey.id}: height must be measured or null.`);
      if(!journey.timeZones?.[point[7]])throw new Error(`${journey.id}: timezone missing.`);
    });
    if(!journey.points[journey.previewIndex])throw new Error(`${journey.id}: invalid preview observation.`);
    if(journey.days.reduce((sum,day)=>sum+day.fixes,0)!==journey.points.length)throw new Error(`${journey.id}: flight days omit observations.`);
  }
  return journeys;
}
