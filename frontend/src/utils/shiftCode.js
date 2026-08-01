const SHIFT_RULES={
 A:{start:8*60,end:16*60,adjust:"end"},
 B:{start:16*60,end:23*60,adjust:"startInverse"},
 P1:{start:8*60,end:12*60,adjust:"end"},
 P2:{start:12*60,end:17*60,adjust:"end"},
 P3:{start:17*60,end:23*60,adjust:"startInverse"},
};
const format=minutes=>`${String(Math.floor(minutes/60)).padStart(2,"0")}:${String(minutes%60).padStart(2,"0")}`;
const baseForStart=minutes=>minutes<12*60?"A":minutes<17*60?"P2":"P3";
export function parseShiftDisplayCode(input){
 let value=String(input||"").trim().toUpperCase().replace(/,/g,".");
 if(value==="AB")value="A+B";
 const explicit=/^(\d{1,2})(?:H(?:(\d{1,2}))?|:(\d{2}))-(\d{1,2})(?:H(?:(\d{1,2}))?|:(\d{2}))$/.exec(value);
 if(explicit){
  const start=Number(explicit[1])*60+Number(explicit[2]??explicit[3]??0),end=Number(explicit[4])*60+Number(explicit[5]??explicit[6]??0);
  if(start>=0&&end<=23*60+59&&start<end)return {baseShiftCode:baseForStart(start),displayCode:value,startTime:format(start),endTime:format(end),customRange:true};
  return null;
 }
 const compositeMatch=/^(A\+B|P1\+P2\+P3|P1\+P2|P2\+P3)(?:([+-])((?:[1-4](?:\.5)?|0\.5)))?$/.exec(value);
 const composite=compositeMatch?.[1]?.split("+");
 if(composite){
  const first=SHIFT_RULES[composite[0]],last=SHIFT_RULES[composite.at(-1)];
  const delta=Number(compositeMatch[3]||0)*60,direction=compositeMatch[2]==="-"?-1:1,end=last.end+direction*delta;
  if(end<=first.start||end>23*60+59)return null;
  return {baseShiftCode:composite[0],displayCode:value,components:composite,startTime:format(first.start),endTime:format(end)};
 }
 const match=/^(A|B|P1|P2|P3)(?:([+-])((?:[1-4](?:\.5)?|0\.5)))?$/.exec(value);
 if(!match)return null;
 const [,baseShiftCode,operator,hoursText]=match,rule=SHIFT_RULES[baseShiftCode],hours=Number(hoursText||0),delta=hours*60;
 let start=rule.start,end=rule.end;
 if(operator){
  const direction=operator==="+"?1:-1;
  if(rule.adjust==="end")end+=direction*delta;
  else start-=direction*delta;
 }
 if(start<0||end>23*60+59||start>=end)return null;
 return {baseShiftCode,displayCode:value,operator:operator||null,adjustmentHours:hours,startTime:format(start),endTime:format(end)};
}
