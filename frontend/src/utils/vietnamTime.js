export const VIETNAM_TIME_ZONE='Asia/Ho_Chi_Minh';
export const vietnamDate=(value,options={})=>value?new Intl.DateTimeFormat('vi-VN',{timeZone:VIETNAM_TIME_ZONE,...options}).format(new Date(value)):'—';
export const vietnamDateOnly=value=>{const match=String(value||'').slice(0,10).match(/^(\d{4})-(\d{2})-(\d{2})$/);return match?`${match[3]}/${match[2]}/${match[1]}`:'—'};
export const vietnamDateTime=value=>vietnamDate(value,{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit',second:'2-digit'});
export const vietnamClock=value=>vietnamDate(value,{hour:'2-digit',minute:'2-digit'});
export const vietnamToday=()=>{const parts=new Intl.DateTimeFormat('en-CA',{timeZone:VIETNAM_TIME_ZONE,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());const get=t=>parts.find(x=>x.type===t)?.value;return `${get('year')}-${get('month')}-${get('day')}`};
