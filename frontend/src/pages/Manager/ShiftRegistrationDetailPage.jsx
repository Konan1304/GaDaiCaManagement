import {useEffect,useMemo,useState} from "react";
import {Link,useParams} from "react-router-dom";
import {FiEdit3,FiRefreshCw} from "react-icons/fi";
import ShiftRegistrationTable from "../../components/ShiftRegistrationTable";
import {scheduleRegistrationApi} from "../../api/services";
const iso=v=>String(v||"").slice(0,10);
const range=(start,end)=>{const a=new Date(`${iso(start)}T00:00:00`),b=new Date(`${iso(end)}T00:00:00`);return Array.from({length:Math.floor((b-a)/864e5)+1},(_,i)=>{const d=new Date(a);d.setDate(a.getDate()+i);return d})};
export default function ShiftRegistrationDetailPage(){
 const {periodId}=useParams(),[data,setData]=useState(null),[search,setSearch]=useState(""),[state,setState]=useState("");
 const load=()=>scheduleRegistrationApi.detail(periodId).then(r=>setData(r.data));useEffect(()=>{load()},[periodId]);
 const dates=useMemo(()=>data?range(data.period.weekStartDate,data.period.weekEndDate):[],[data]);
 const allEmployees=useMemo(()=>{if(!data)return[];const map=new Map();data.rows.forEach(row=>{if(!map.has(row.employeeId))map.set(row.employeeId,{...row,registrations:{}});if(row.workDate)map.get(row.employeeId).registrations[iso(row.workDate)]=row.shiftCode});return [...map.values()].map(e=>({...e,complete:dates.length>0&&dates.every(d=>e.registrations[iso(d)])}))},[data,dates]);
 const employees=allEmployees.filter(e=>(!search||`${e.fullName} ${e.employeeCode}`.toLowerCase().includes(search.toLowerCase()))&&(!state||(state==="complete")===e.complete));
 if(!data)return <section className="card employee-table-empty">Đang tải bảng đăng ký...</section>;
 const completed=allEmployees.filter(e=>e.complete).length,total=allEmployees.length,percent=total?Math.round(completed*100/total):0;
 return <section className="card registration-sheet"><div className="section-title"><div><h2>{data.period.title}</h2><p>{data.period.branchName} · {completed}/{total} nhân viên hoàn thành ({percent}%)</p></div><div className="registration-head-actions"><button className="btn btn-light" onClick={load}><FiRefreshCw/> Làm mới dữ liệu</button><Link className="btn btn-primary" to={`/manager/schedules/builder/${periodId}`}><FiEdit3/> Xếp lịch</Link></div></div><div className="registration-progress"><span style={{width:`${percent}%`}}/></div><div className="registration-filters"><input placeholder="Tìm nhân viên..." value={search} onChange={e=>setSearch(e.target.value)}/><select value={state} onChange={e=>setState(e.target.value)}><option value="">Tất cả</option><option value="complete">Đã hoàn thành</option><option value="incomplete">Chưa hoàn thành</option></select></div><ShiftRegistrationTable dates={dates} employees={employees}/><div className="registration-choice-note">Chưa chọn: màu xám · Nghỉ: đỏ · FULL: xanh lá · A: vàng · B: xanh dương · P1/P2/P3: tím/cam/xanh ngọc</div></section>
}
