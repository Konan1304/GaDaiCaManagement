export const dateKey=(date)=>{const d=new Date(date),offset=d.getTimezoneOffset();return new Date(d.getTime()-offset*60000).toISOString().slice(0,10)};
export const money=(value)=>new Intl.NumberFormat("vi-VN",{style:"currency",currency:"VND",maximumFractionDigits:0}).format(Number(value)||0);
export const time=(value)=>{
  if(!value)return "--:--";
  if(typeof value==="string"&&/^\d{2}:\d{2}/.test(value))return value.slice(0,5);
  const parsed=new Date(value);
  // SQL Server TIME được driver trả về dưới dạng ngày 1970 UTC. Không cộng múi giờ trình duyệt.
  if(typeof value==="string"&&value.startsWith("1970-01-01T")){
    return `${String(parsed.getUTCHours()).padStart(2,"0")}:${String(parsed.getUTCMinutes()).padStart(2,"0")}`;
  }
  return parsed.toLocaleTimeString("vi-VN",{hour:"2-digit",minute:"2-digit"});
};
export const shortDate=(value)=>value?new Date(value).toLocaleDateString("vi-VN"):"";
export const apiError=(error)=>error.response?.data?.message||"Không thể kết nối máy chủ. Vui lòng thử lại.";
