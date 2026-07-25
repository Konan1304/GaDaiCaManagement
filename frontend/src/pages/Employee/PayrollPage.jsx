import {useEffect,useMemo,useState} from "react";
import {FiAlertTriangle,FiCalendar,FiCheckCircle,FiClock,FiDollarSign} from "react-icons/fi";
import {employeeApi,payrollApi} from "../../api/services";

const money=value=>Math.round(Number(value||0)).toLocaleString("vi-VN")+"đ";
const statusName={draft:"Lương tạm tính",confirmed:"Đã xác nhận",paid:"Đã trả"};
const formatTime=value=>value?String(value).slice(11,16):"—";
const formatWorked=value=>`${Math.floor(Number(value||0)/60)} giờ ${Number(value||0)%60} phút`;
const displayDate=value=>new Date(`${value}T00:00:00`).toLocaleDateString("vi-VN",{weekday:"short",day:"2-digit",month:"2-digit"});
const shortDate=value=>new Date(`${value}T00:00:00`).toLocaleDateString("vi-VN",{day:"2-digit",month:"2-digit"});
const localDateKey=value=>`${value.getFullYear()}-${String(value.getMonth()+1).padStart(2,"0")}-${String(value.getDate()).padStart(2,"0")}`;
function groupWeeks(rows){
 const groups=new Map();
 for(const row of [...rows].sort((a,b)=>a.workDate.localeCompare(b.workDate))){
  const value=new Date(`${row.workDate}T00:00:00`),monday=new Date(value);monday.setDate(value.getDate()-((value.getDay()+6)%7));
  const key=localDateKey(monday);if(!groups.has(key))groups.set(key,[]);groups.get(key).push(row);
 }
 return [...groups.entries()].map(([key,items],index)=>{
  const monday=new Date(`${key}T00:00:00`),sunday=new Date(monday);sunday.setDate(monday.getDate()+6);
  const monthStart=`${items[0].workDate.slice(0,7)}-01`,monthEnd=new Date(Number(items[0].workDate.slice(0,4)),Number(items[0].workDate.slice(5,7)),0);
  return {number:index+1,items,start:key<monthStart?monthStart:key,end:localDateKey(sunday)>localDateKey(monthEnd)?localDateKey(monthEnd):localDateKey(sunday),
   workDays:new Set(items.filter(x=>x.checkOutTime).map(x=>x.workDate)).size,shifts:items.length,
   minutes:items.reduce((sum,x)=>sum+Number(x.workedMinutes||0),0),late:items.reduce((sum,x)=>sum+Number(x.lateMinutes||0),0),
   early:items.reduce((sum,x)=>sum+Number(x.earlyLeaveMinutes||0),0)};
 });
}

export default function EmployeePayrollPage(){
 const [month,setMonth]=useState(new Date().toISOString().slice(0,7)),[data,setData]=useState(null),[attendance,setAttendance]=useState([]),[loading,setLoading]=useState(true),[error,setError]=useState("");
 useEffect(()=>{setLoading(true);setError("");Promise.all([
  payrollApi.mine(month).then(r=>setData(r.data)),
  employeeApi.attendanceHistory(month).then(r=>setAttendance(r.data||[]))
 ]).catch(e=>setError(e.response?.data?.message||"Không tải được bảng lương")).finally(()=>setLoading(false))},[month]);
 const payroll=useMemo(()=>{
  if(!data)return null;
  const hasTest=attendance.some(row=>row.isTest);
  const useAttendance=attendance.length>0&&(hasTest||Number(data.totalWorkHours||0)===0);
  const minutes=attendance.reduce((sum,row)=>sum+Number(row.workedMinutes||0),0);
  const workDays=new Set(attendance.filter(row=>row.checkOutTime).map(row=>row.workDate)).size;
  const hourlyRate=Number(data.hourlyRate||26000);
  const allowance=Number(data.parkingAllowance||0)+Number(data.mealAllowance||0)+Number(data.otherAllowance||0)+Number(data.bonus||0);
  const deduction=Number(data.uniformDeduction||0)+Number(data.salaryAdvance||0)+Number(data.otherDeduction||0);
  const totalHours=useAttendance?minutes/60:Number(data.totalWorkHours||0);
  const baseSalary=useAttendance?Math.round(totalHours*hourlyRate):Number(data.baseSalary||0);
  return {...data,hasTest,useAttendance,totalMinutes:useAttendance?minutes:Math.round(totalHours*60),
   totalWorkDays:useAttendance?workDays:Number(data.totalWorkDays||0),totalWorkHours:totalHours,
   baseSalary,allowance,deduction,netSalary:useAttendance?baseSalary+allowance-deduction:Number(data.netSalary||0)};
 },[data,attendance]);
 const weeks=useMemo(()=>groupWeeks(attendance),[attendance]);
 return <div className="emp-payroll">
  <section className="emp-card emp-payroll-month"><label>Tháng đang xem<input type="month" value={month} onChange={e=>setMonth(e.target.value)}/></label>{payroll&&<span className={`emp-payroll-status ${payroll.status}`}>{payroll.hasTest?"Lương kiểm thử":statusName[payroll.status]}</span>}</section>
  {error&&<div className="emp-error">{error}</div>}{loading?<div className="emp-card emp-empty">Đang tải bảng lương...</div>:payroll?<>
  {payroll.hasTest&&<div className="emp-payroll-test-note">Dữ liệu chấm công kiểm thử đang được dùng để tính lương xem trước. Số tiền này không ghi vào bảng lương chính thức.</div>}
  <section className="emp-payroll-overview"><div className="emp-card"><FiCalendar/><small>Ngày đã làm</small><b>{payroll.totalWorkDays} ngày</b></div><div className="emp-card"><FiClock/><small>Tổng giờ</small><b>{Number(payroll.totalWorkHours).toFixed(2)} giờ</b><small>{formatWorked(payroll.totalMinutes)}</small></div><div className="emp-card"><FiDollarSign/><small>Lương giờ</small><b>{money(payroll.hourlyRate)}</b></div></section>
  <section className="emp-card emp-payroll-summary"><h2>Tổng hợp thu nhập</h2><p><span>Lương theo giờ</span><b>{money(payroll.baseSalary)}</b></p><p className="plus"><span>Tổng phụ cấp & thưởng</span><b>+{money(payroll.allowance)}</b></p><p className="minus"><span>Tổng khấu trừ</span><b>-{money(payroll.deduction)}</b></p><p className="net"><span>Tổng lương tạm tính</span><b>{money(payroll.netSalary)}</b></p><small className="emp-muted">{payroll.hasTest?"Bảng lương xem trước từ dữ liệu test, không dùng để thanh toán.":"Đây là lương tạm tính, bảng lương chưa được quản lý xác nhận."}</small></section>
  <div className="emp-section-head"><h2>Lịch sử chấm công tính lương</h2><span className="emp-muted">{attendance.length} ca</span></div>
  {weeks.length?<div className="attendance-week-list payroll-attendance-weeks">{weeks.map(week=><section className="emp-card attendance-week-card" key={week.number}>
   <header><div><small>TUẦN {week.number}</small><h3>{shortDate(week.start)} – {shortDate(week.end)}</h3></div>{week.items.some(x=>x.isTest)&&<span>Dữ liệu test</span>}</header>
   <div className="attendance-week-stats">
    <div><FiCalendar/><small>Ngày công</small><b>{week.workDays}</b></div><div><FiClock/><small>Tổng giờ</small><b>{formatWorked(week.minutes)}</b></div>
    <div><FiCheckCircle/><small>Tổng ca</small><b>{week.shifts}</b></div><div><FiAlertTriangle/><small>Đi trễ</small><b>{week.late} phút</b></div>
    <div><span className="running-icon">🏃</span><small>Về sớm</small><b>{week.early} phút</b></div><div><FiDollarSign/><small>Lương tuần</small><b>{money(week.minutes/60*Number(payroll.hourlyRate||0))}</b></div>
   </div>
   <div className="attendance-week-days">{week.items.map(row=><article key={row.attendanceId}><div><b>{displayDate(row.workDate)}</b><small>{row.shiftCode} · {row.shiftName}</small></div><span><small>Vào</small><b>{formatTime(row.checkInTime)}</b></span><span><small>Ra</small><b>{formatTime(row.checkOutTime)}</b></span><span><small>Thời gian</small><b>{row.status==="completed"?formatWorked(row.workedMinutes):"Đang làm"}</b></span><div className="attendance-day-flags">{row.lateMinutes>0&&<em>Trễ {row.lateMinutes}p</em>}{row.earlyLeaveMinutes>0&&<em>Về sớm {row.earlyLeaveMinutes}p</em>}</div></article>)}</div>
  </section>)}</div>:<section className="emp-card emp-empty"><FiClock/><span>Tháng này chưa có dữ liệu chấm công.</span></section>}
  </>:<div className="emp-card emp-empty">Không tìm thấy hồ sơ nhân viên</div>}
 </div>
}
