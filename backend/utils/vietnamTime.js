const TIME_ZONE='Asia/Ho_Chi_Minh';
function parts(value=new Date()){return Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:TIME_ZONE,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(new Date(value)).filter(x=>x.type!=='literal').map(x=>[x.type,x.value]))}
function dateKey(value){const p=parts(value);return `${p.year}-${p.month}-${p.day}`}
function display(value){return new Intl.DateTimeFormat('vi-VN',{timeZone:TIME_ZONE,dateStyle:'short',timeStyle:'medium'}).format(new Date(value))}
module.exports={TIME_ZONE,parts,dateKey,display};
