const SHIFT_RULES={
 A:{start:8*60,end:16*60,adjust:"end"},
 B:{start:16*60,end:23*60,adjust:"startInverse"},
 P1:{start:8*60,end:12*60,adjust:"end"},
 P2:{start:12*60,end:17*60,adjust:"startInverse"},
 P3:{start:17*60,end:23*60,adjust:"startInverse"},
};
const format=minutes=>`${String(Math.floor(minutes/60)).padStart(2,"0")}:${String(minutes%60).padStart(2,"0")}`;
export function parseShiftDisplayCode(input){
 const value=String(input||"").trim().toUpperCase(),match=/^(A|B|P1|P2|P3)(?:([+-])([1-4]))?$/.exec(value);
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
