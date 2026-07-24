import {useEffect,useMemo,useState} from "react";
import {Link} from "react-router-dom";
import {FiCalendar,FiClock} from "react-icons/fi";
import {employeeApi} from "../../api/services";
import {apiError,time} from "../../utils/employeeFormat";
const iso=v=>{
 if(v instanceof Date){
  const year=v.getFullYear(),month=String(v.getMonth()+1).padStart(2,"0"),day=String(v.getDate()).padStart(2,"0");
  return `${year}-${month}-${day}`;
 }
 return String(v||"").slice(0,10);
},dayNames=["Chủ nhật","Thứ Hai","Thứ Ba","Thứ Tư","Thứ Năm","Thứ Sáu","Thứ Bảy"];
export default function ShiftRegistrationPage(){const [period,setPeriod]=useState(undefined),[selected,setSelected]=useState({}),[note,setNote]=useState(""),[message,setMessage]=useState(""),[error,setError]=useState(""),[saving,setSaving]=useState(false);
 useEffect(()=>{employeeApi.currentShiftRegistration().then(r=>{setPeriod(r.data);if(r.data){const values={};r.data.existingRegistrations.forEach(x=>values[iso(x.workDate)]=x.shiftCode);setSelected(values);setNote(r.data.existingRegistrations[0]?.note||"")}}).catch(e=>setError(apiError(e)))},[]);
 const dates=useMemo(()=>{if(!period)return[];const start=new Date(`${iso(period.startDate||period.weekStartDate)}T00:00:00`),end=new Date(`${iso(period.endDate||period.weekEndDate)}T00:00:00`),length=Math.floor((end-start)/864e5)+1;return Array.from({length},(_,i)=>{const d=new Date(start);d.setDate(start.getDate()+i);return d})},[period]);
 async function save(){setSaving(true);setMessage("");setError("");try{const registrations=Object.entries(selected).filter(([,code])=>code).map(([workDate,shiftCode])=>({workDate,shiftCode})),r=await employeeApi.saveShiftRegistration(period.periodId,{registrations,note});setMessage(r.message)}catch(e){setError(apiError(e))}finally{setSaving(false)}}
 if(period===undefined)return <div className="emp-card emp-empty">Đang tải đợt đăng ký...</div>;
 if(!period)return <div className="emp-card emp-empty"><FiCalendar/><div>Hiện chưa có đợt đăng ký lịch làm</div></div>;
 const remaining=Math.max(0,new Date(period.registrationCloseAt)-new Date(period.serverTime)),hours=Math.ceil(remaining/36e5),locked=period.status==="locked",published=period.status==="published";
 return <div>{message&&<div className="emp-toast">{message}</div>}{error&&<div className="emp-error">{error}</div>}
  <section className="emp-card shift-reg-summary"><span className={`emp-badge ${period.canRegister?"success":"warn"}`}>{period.status==="open"?"Đang mở":published?"Đã công bố":"Đã khóa"}</span><h2>{period.title}</h2><p className="emp-muted">{period.branchName} · {new Date(`${iso(period.startDate||period.weekStartDate)}T00:00:00`).toLocaleDateString("vi-VN")} – {new Date(`${iso(period.endDate||period.weekEndDate)}T00:00:00`).toLocaleDateString("vi-VN")}</p>{period.canRegister&&<p><FiClock/> Còn khoảng {hours>24?`${Math.floor(hours/24)} ngày ${hours%24} giờ`:`${hours} giờ`} để đăng ký</p>}{locked&&<div className="emp-error">Quản lý đã khóa đợt đăng ký này</div>}{published&&<div className="emp-toast">Lịch chính thức đã được công bố</div>}</section>
  <div className="shift-registration-days">{dates.map(d=>{const key=iso(d),choice=selected[key]||"";return <article className="emp-card shift-registration-day" key={key}><header><div><b>{dayNames[d.getDay()]}</b><small>{d.toLocaleDateString("vi-VN")}</small></div><span>{choice||"Nghỉ"}</span></header><div className="shift-choice-grid"><button disabled={!period.canRegister} className={!choice?"selected rest":""} onClick={()=>setSelected(v=>({...v,[key]:""}))}>Không đăng ký</button>{period.shifts.map(s=><button disabled={!period.canRegister} className={choice===s.shiftCode?`selected shift-${s.shiftCode.toLowerCase()}`:""} key={s.shiftId} onClick={()=>setSelected(v=>({...v,[key]:v[key]===s.shiftCode?"":s.shiftCode}))}><b>{s.shiftCode}</b><small>{time(s.startTime)}–{time(s.endTime)}</small></button>)}</div></article>})}</div>
  <section className="emp-card emp-form"><label>Ghi chú cho quản lý<textarea disabled={!period.canRegister} value={note} onChange={e=>setNote(e.target.value)}/></label>{period.canRegister&&<button className="emp-button" disabled={saving} onClick={save}>{saving?"Đang lưu...":"Lưu đăng ký"}</button>}{published&&<Link className="emp-button" style={{display:"grid",placeItems:"center",textDecoration:"none"}} to="/employee/schedule">Đi tới lịch làm</Link>}</section>
 </div>}
