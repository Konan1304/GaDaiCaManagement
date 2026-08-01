import {useCallback,useEffect,useState} from "react";
import {FiCheckCircle,FiClock,FiLogIn,FiLogOut,FiX} from "react-icons/fi";
import {employeeApi} from "../../api/services";
import {time} from "../../utils/employeeFormat";

const statusLabel=attendance=>{
 if(!attendance)return "Chưa chấm công";
 if(attendance.status==="completed")return "Đã hoàn thành";
 if(attendance.lateMinutes>0)return `Đi trễ ${attendance.lateMinutes} phút`;
 return "Đang làm việc · Đúng giờ";
};
const worked=value=>`${Math.floor(Number(value||0)/60)} giờ ${Number(value||0)%60} phút`;
const scheduleLabel=item=>`${new Date(`${item.workDate}T00:00:00`).toLocaleDateString("vi-VN",{weekday:"long",day:"2-digit",month:"2-digit",year:"numeric"})} — Ca ${item.shiftCode} (${time(item.startTime)}–${time(item.endTime)})`;

export default function AttendancePage(){
 const isSandbox=import.meta.env.VITE_APP_ENV==="sandbox";
 const [data,setData]=useState(null);
 const [selectedDate,setSelectedDate]=useState("");
 const [scheduleOptions,setScheduleOptions]=useState([]),[selectedScheduleId,setSelectedScheduleId]=useState("");
 const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(""),[message,setMessage]=useState(""),[confirmOut,setConfirmOut]=useState(false);
 const loadToday=useCallback((date,scheduleId)=>employeeApi.attendanceToday(date,scheduleId).then(r=>{setData(r.data);setSelectedDate(r.data.businessDate||date||"")}),[]);
 useEffect(()=>{let active=true;setLoading(true);setError("");const request=isSandbox?Promise.all([employeeApi.attendanceTestSchedules(),employeeApi.attendanceToday()]).then(async([optionsResult,todayResult])=>{if(!active)return;const options=optionsResult.data||[];setScheduleOptions(options);const selected=options.find(item=>Number(item.scheduleId)===Number(todayResult.data?.schedule?.scheduleId))||options[0];if(selected){setSelectedScheduleId(String(selected.scheduleId));await loadToday(selected.workDate,selected.scheduleId)}else{setData(todayResult.data);setSelectedDate(todayResult.data?.businessDate||"")}}):loadToday();request.catch(e=>active&&setError(e.response?.data?.message||"Không tải được dữ liệu chấm công")).finally(()=>active&&setLoading(false));return()=>{active=false}},[isSandbox,loadToday]);
 async function changeTestSchedule(value){const selected=scheduleOptions.find(item=>String(item.scheduleId)===value);if(!selected)return;setSelectedScheduleId(value);setSelectedDate(selected.workDate);setLoading(true);setError("");setMessage("");try{await loadToday(selected.workDate,selected.scheduleId)}catch(e){setError(e.response?.data?.message||"Không tải được lịch chấm công")}finally{setLoading(false)}}
 const activeScheduleId=isSandbox?Number(selectedScheduleId):data?.schedule?.scheduleId;
 async function checkIn(){if(busy)return;setBusy(true);setError("");setMessage("");try{const r=await employeeApi.attendanceCheckIn({scheduleId:activeScheduleId,note:"",...(isSandbox?{workDate:selectedDate}:{})});setMessage(r.message);await loadToday(isSandbox?selectedDate:undefined,isSandbox?activeScheduleId:undefined)}catch(e){setError(e.response?.data?.message||"Không thể chấm công vào")}finally{setBusy(false)}}
 async function checkOut(){if(busy)return;setBusy(true);setError("");setMessage("");try{const r=await employeeApi.attendanceCheckOut({scheduleId:activeScheduleId,note:"",...(isSandbox?{workDate:selectedDate}:{})});setMessage(r.message);setConfirmOut(false);await loadToday(isSandbox?selectedDate:undefined,isSandbox?activeScheduleId:undefined)}catch(e){setError(e.response?.data?.message||"Không thể chấm công ra");setConfirmOut(false)}finally{setBusy(false)}}
 if(loading)return <section className="emp-card emp-empty"><FiClock/><div>Đang tải ca làm hôm nay...</div></section>;
 const {employee,schedule,attendance}=data||{};
 return <div className="attendance-page">
  {message&&<div className="emp-success">{message}</div>}{error&&<div className="emp-error">{error}</div>}
  {isSandbox&&<section className="emp-card attendance-test-date"><div><strong>Ca chấm công kiểm thử</strong><small>Chỉ hiển thị lịch chính thức đã công bố của tài khoản này.</small></div><select value={selectedScheduleId} onChange={event=>changeTestSchedule(event.target.value)} disabled={!scheduleOptions.length}><option value="">{scheduleOptions.length?"Chọn lịch làm":"Không có lịch đã công bố"}</option>{scheduleOptions.map(item=><option key={item.scheduleId} value={item.scheduleId}>{scheduleLabel(item)}</option>)}</select></section>}
  <section className="emp-card attendance-identity"><div><small>Ngày hiện tại</small><b>{new Date(data?.serverTime||Date.now()).toLocaleDateString("vi-VN",{weekday:"long",day:"2-digit",month:"2-digit",year:"numeric",timeZone:"Asia/Ho_Chi_Minh"})}</b></div><div><small>Nhân viên</small><b>{employee?.fullName}</b><span>{employee?.employeeCode}</span></div><div><small>Vị trí</small><b>{employee?.positionName}</b><span>{employee?.branchName}</span></div></section>
  {!schedule?<section className="emp-card attendance-no-schedule"><FiClock/><h2>Hôm nay bạn không có lịch làm.</h2><p>Lịch chấm công chỉ hiển thị sau khi quản lý đã công bố lịch chính thức.</p></section>:<section className="emp-card attendance-main">
   <div className="attendance-shift-head"><div><small>Ca hôm nay</small><h2>{schedule.shiftCode} · {schedule.shiftName}</h2><p>{employee.positionName} · {employee.branchName}</p></div><span className={`attendance-state ${attendance?.status||"not_checked_in"}`}>{statusLabel(attendance)}</span></div>
   <div className="attendance-schedule-time"><div><small>Bắt đầu</small><b>{time(schedule.startTime)}</b></div><span/><div><small>Kết thúc</small><b>{time(schedule.endTime)}</b></div></div>
   {attendance&&<div className="attendance-result"><div><small>Giờ vào</small><b>{time(attendance.checkInTime)}</b></div><div><small>Giờ ra</small><b>{time(attendance.checkOutTime)}</b></div><div><small>Tổng thời gian</small><b>{attendance.status==="completed"?worked(attendance.workedMinutes):"Đang tính"}</b></div></div>}
   {!attendance&&<button className="attendance-action check-in" disabled={busy} onClick={checkIn}><FiLogIn/>{busy?"Đang ghi nhận...":"Chấm công vào"}</button>}
   {attendance?.status!=="completed"&&attendance?.checkInTime&&<button className="attendance-action check-out" disabled={busy} onClick={()=>setConfirmOut(true)}><FiLogOut/>{busy?"Đang ghi nhận...":"Chấm công ra"}</button>}
   {attendance?.status==="completed"&&<div className="attendance-complete"><FiCheckCircle/> Bạn đã hoàn tất chấm công cho ca này{attendance.earlyLeaveMinutes>0?` · Về sớm ${attendance.earlyLeaveMinutes} phút`:""}.</div>}
  </section>}
  {confirmOut&&<div className="attendance-confirm-backdrop"><div className="attendance-confirm"><button onClick={()=>setConfirmOut(false)}><FiX/></button><FiLogOut/><h2>Xác nhận chấm công ra</h2><p>Bạn có chắc muốn chấm công ra không?</p><div><button className="btn-cancel" onClick={()=>setConfirmOut(false)}>Ở lại ca</button><button className="btn-confirm" disabled={busy} onClick={checkOut}>{busy?"Đang xử lý...":"Chấm công ra"}</button></div></div></div>}
  {/* Trình duyệt không đọc vân tay; dữ liệu thật được lưu tại backend và có thể đồng bộ từ API máy chấm công. */}
 </div>
}
