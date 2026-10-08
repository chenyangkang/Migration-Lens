export function individualsForSpecies(journeys,species){
  const groups=new Map();
  for(const journey of journeys.filter(j=>j.species===species)){
    if(!groups.has(journey.individual))groups.set(journey.individual,[]);
    groups.get(journey.individual).push(journey);
  }
  return [...groups].map(([individual,migrations])=>({individual,migrations}));
}
export function migrationsForIndividual(journeys,species,individual){
  return journeys.filter(j=>j.species===species&&j.individual===individual).sort((a,b)=>b.points[0][0]-a.points[0][0]);
}
