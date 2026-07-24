import {useEffect,useMemo,useState} from "react";
import {FiChevronLeft,FiChevronRight,FiPlus,FiSearch} from "react-icons/fi";
import {Link} from "react-router-dom";
import {managerEmployeeApi,managerScheduleApi} from "../../api/services";

const dayNames=["Chủ nhật","Thứ 2","Thứ 3","Thứ 4","Thứ 5","Thứ 6","Thứ 7"];
const dateKey=date=>{const value=date instanceof Date?date:new Date(`${String(date).slice(0,10)}T00:00:00`);return `${value.getFullYear()}-${String(value.getMonth()+1).padStart(2,"0")}-${String(value.getDate()).padStart(2,"0")}`};
const mondayOf=date=>{const value=new Date(date);value.setHours(0,0,0,0);value.setDate(value.getDate()-((value.getDay()+6)%7));return value};
const statusLabels={scheduled:"Đã xếp",working:"Đang làm",completed:"Hoàn thành",cancelled:"Đã hủy"};

export default function SchedulePage(){
 const [anchor,setAnchor]=useState(()=>mondayOf(new Date())),[data,setData]=useState({employees:[],schedules:[]});
 const [branches,setBranches]=useState([]),[positions,setPositions]=useState([]),[filters,setFilters]=useState({branchId:"",positionId:"",search:""});
 const [loading,setLoading]=useState(true),[error,setError]=useState("");
 const days=useMemo(()=>Array.from({length:7},(_,index)=>{const date=new Date(anchor);date.setDate(anchor.getDate()+index);return date}),[anchor]);
 const from=dateKey(days[0]),to=dateKey(days[6]);
 useEffect(()=>{Promise.all([managerEmployeeApi.branches(),managerEmployeeApi.positions()]).then(([b,p])=>{setBranches(b.data||[]);setPositions(p.data||[])})},[]);
 useEffect(()=>{let active=true;setLoading(true);setError("");setData({employees:[],schedules:[]});const timer=setTimeout(()=>managerScheduleApi.list({...filters,from,to}).then(response=>{if(active)setData(response.data)}).catch(e=>{if(active)setError(e.response?.data?.message||"Không tải được lịch làm")}).finally(()=>{if(active)setLoading(false)}),filters.search?250:0);return()=>{active=false;clearTimeout(timer)}},[from,to,filters.branchId,filters.positionId,filters.search]);
 const scheduleMap=useMemo(()=>data.schedules.reduce((map,item)=>{(map[`${item.employeeId}_${item.workDate}`]??=[]).push(item);return map},{}),[data.schedules]);
 const moveWeek=amount=>setAnchor(value=>{const next=new Date(value);next.setDate(value.getDate()+amount*7);return next});
 return <section className="card list-card manager-schedule-page">
  <div className="section-title"><div><h2>Lịch làm việc</h2><p>Tuần {days[0].toLocaleDateString("vi-VN")} - {days[6].toLocaleDateString("vi-VN")}</p></div><Link className="btn btn-primary" to="/manager/shift-registration"><FiPlus/> Xếp lịch</Link></div>
  <div className="schedule-tools manager-schedule-tools"><div><button className="icon-btn" onClick={()=>moveWeek(-1)}><FiChevronLeft/></button><button className="btn btn-light" onClick={()=>setAnchor(mondayOf(new Date()))}>Tuần này</button><button className="icon-btn" onClick={()=>moveWeek(1)}><FiChevronRight/></button></div><div className="manager-shift-legend">{["A","B","P1","P2","P3"].map(code=><span key={code}><i className={`code-${code.toLowerCase()}`}/>{code}</span>)}<span><i className="unassigned"/>Chưa xếp</span></div></div>
  <div className="manager-schedule-filters"><label><FiSearch/><input placeholder="Tìm tên hoặc mã nhân viên" value={filters.search} onChange={e=>setFilters({...filters,search:e.target.value})}/></label><select value={filters.branchId} onChange={e=>setFilters({...filters,branchId:e.target.value})}><option value="">Tất cả chi nhánh</option>{branches.map(item=><option value={item.id} key={item.id}>{item.branchName}</option>)}</select><select value={filters.positionId} onChange={e=>setFilters({...filters,positionId:e.target.value})}><option value="">Tất cả vị trí</option>{positions.map(item=><option value={item.id} key={item.id}>{item.positionName}</option>)}</select></div>
  {error&&<div className="manager-form-error">{error}</div>}
  {loading?<div className="manager-schedule-loading"><i/><i/><i/></div>:data.employees.length?<div className="table-wrap schedule-table manager-real-schedule"><table><thead><tr><th>Nhân viên</th>{days.map(date=><th key={dateKey(date)}>{dayNames[date.getDay()]}<small>{date.toLocaleDateString("vi-VN",{day:"2-digit",month:"2-digit"})}</small></th>)}</tr></thead><tbody>{data.employees.map(employee=><tr key={employee.employeeId}><td><b>{employee.fullName}</b><small>{employee.employeeCode} · {employee.positionName}</small><small>{employee.branchName}</small></td>{days.map(date=>{const entries=scheduleMap[`${employee.employeeId}_${dateKey(date)}`]||[];return <td key={dateKey(date)}>{entries.length?entries.map(item=><div className={`manager-schedule-shift code-${String(item.shiftCode).toLowerCase()} status-${item.status}`} key={item.scheduleId}><b>{item.shiftCode} · {item.shiftName}</b><small>{item.startTime} - {item.endTime}</small><em>{statusLabels[item.status]||item.status}</em></div>):<span className="manager-unassigned">Chưa xếp</span>}</td>})}</tr>)}</tbody></table></div>:<div className="employee-table-empty">Chưa có nhân viên trong chi nhánh</div>}
 </section>
}
