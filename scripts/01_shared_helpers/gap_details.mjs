import {formatFlightTime,solarElevation} from './time_and_light.mjs';

export function formatDuration(seconds) {
  const minutes=Math.max(1,Math.round(seconds/60)),hours=Math.floor(minutes/60),days=Math.floor(hours/24);
  return [days?`${days}d`:null,hours%24?`${hours%24}h`:null,minutes%60?`${minutes%60}m`:null].filter(Boolean).join(' ');
}

export function gapDetails(journey,gap,clockBasis='local') {
  const before=journey.points[gap.fromIndex],after=journey.points[gap.toIndex];
  const format=point=>{
    const zone=journey.timeZones[point[7]],local=formatFlightTime(point[0],zone);
    return clockBasis==='utc'?`${local.utcDate} · ${local.utcTime} UTC`:`${local.date} · ${local.time} (${local.offset})`;
  };
  const includesNight=Array.from({length:24},(_,index)=>gap.start+(index+.5)/24*gap.duration)
    .some(time=>solarElevation(time,before[1],before[2])<-6);
  const explanation=journey.gapExplanation??'This curated flight selection omits time outside active flight windows, including rest and overnight periods. The original archive may contain additional fixes.';
  return {duration:formatDuration(gap.duration),from:format(before),to:format(after),explanation,
    nightNote:includesNight?'Includes nighttime at the last recorded location; this does not establish why positions are missing.':'The cause of this interval is not inferred from daylight.'};
}
