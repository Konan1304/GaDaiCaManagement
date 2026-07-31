import {useEffect,useMemo,useState} from "react";
import {FiCalendar,FiClock} from "react-icons/fi";
import {employeeApi} from "../../api/services";
import ShiftRegistrationTable from "../../components/ShiftRegistrationTable";
import {apiError} from "../../utils/employeeFormat";
const iso=value=>value instanceof Date
 ? `${value.getFullYear()}-${String(value.getMonth()+1).padStart(2,"0")}-${String(value.getDate()).padStart(2,"0")}`
 : String(value||"").slice(0,10);
const range=(start,end)=>{const a=new Date(`${iso(start)}T00:00:00`),b=new Date(`${iso(end)}T00:00:00`);return Array.from({length:Math.floor((b-a)/864e5)+1},(_,i)=>{const d=new Date(a);d.setDate(a.getDate()+i);return d})};
export default function ShiftRegistrationPage(){
 const [period,setPeriod]=useState(undefined),[selected,setSelected]=useState({}),[note,setNote]=useState(""),[message,setMessage]=useState(""),[error,setError]=useState(""),[saving,setSaving]=useState(false);
 const load=()=>employeeApi.currentShiftRegistration().then(r=>{setPeriod(r.data);if(r.data){const own={};r.data.existingRegistrations.forEach(x=>own[iso(x.workDate)]=x.shiftCode);setSelected(own);setNote(r.data.existingRegistrations[0]?.note||"")}}).catch(e=>setError(apiError(e)));
 useEffect(()=>{load();const refresh=()=>document.visibilityState==="visible"&&load();document.addEventListener("visibilitychange",refresh);return()=>document.removeEventListener("visibilitychange",refresh)},[]);
 const dates=useMemo(()=>period?range(period.startDate,period.endDate):[],[period]);
 const employees=useMemo(()=>{if(!period)return[];const map=new Map();period.tableRows.forEach(row=>{if(!map.has(row.employeeId))map.set(row.employeeId,{...row,registrations:{}});if(row.workDate)map.get(row.employeeId).registrations[iso(row.workDate)]=row.shiftCode});return [...map.values()]},[period]);
 async function save(){setSaving(true);setError("");setMessage("");try{const registrations=dates.filter(d=>selected[iso(d)]).map(d=>({workDate:iso(d),shiftCode:selected[iso(d)]}));const r=await employeeApi.saveShiftRegistration(period.periodId,{registrations,note});setMessage(r.message);await load()}catch(e){setError(apiError(e))}finally{setSaving(false)}}
 if(period===undefined)return <div className="emp-card emp-empty">Đang tải đợt đăng ký...</div>;
 if(!period)return <div className="emp-card emp-empty"><FiCalendar/><div>Hiện chưa có đợt đăng ký lịch làm</div></div>;
 const remaining=Math.max(0,new Date(period.registrationCloseAt)-new Date(period.serverTime)),hours=Math.ceil(remaining/36e5);
 return <div>{message&&<div className="emp-toast">{message}</div>}{error&&<div className="emp-error">{error}</div>}<section className="emp-card shift-reg-summary"><span className={`emp-badge ${period.canRegister?"success":"warn"}`}>{period.status==="open"?"Đang mở":period.status==="published"?"Đã công bố":"Đã khóa"}</span><h2>{period.title}</h2><p className="emp-muted">{period.branchName} · {new Date(`${iso(period.startDate)}T00:00:00`).toLocaleDateString("vi-VN")} – {new Date(`${iso(period.endDate)}T00:00:00`).toLocaleDateString("vi-VN")}</p>{period.canRegister&&<p><FiClock/> Còn khoảng {hours>24?`${Math.floor(hours/24)} ngày ${hours%24} giờ`:`${hours} giờ`} để đăng ký</p>}{!period.canRegister&&<div className="emp-error">Đợt đăng ký đã khóa. Bạn không thể thay đổi nguyện vọng.</div>}</section>
 <section className="emp-card weekly-registration-card"><ShiftRegistrationTable dates={dates} employees={employees} currentEmployeeId={period.currentEmployeeId} editable={period.canRegister} values={selected} onChange={(key,value)=>setSelected(old=>({...old,[key]:value}))}/><div className="registration-choice-note">FULL chỉ có nghĩa là rảnh cả ngày để quản lý xếp ca phù hợp, không phải ca 08:00–23:00.</div></section>
 <section className="emp-card emp-form"><label>Ghi chú cho quản lý<textarea disabled={!period.canRegister} value={note} onChange={e=>setNote(e.target.value)}/></label>{period.canRegister&&<button className="emp-button" disabled={saving} onClick={save}>{saving?"Đang lưu...":"Lưu đăng ký"}</button>}</section></div>
}
