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

export default function AttendancePage(){
 const [data,setData]=useState(null);
 const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(""),[message,setMessage]=useState(""),[confirmOut,setConfirmOut]=useState(false);
 const loadToday=useCallback(()=>employeeApi.attendanceToday().then(r=>setData(r.data)),[]);
 useEffect(()=>{setLoading(true);setError("");loadToday().catch(e=>setError(e.response?.data?.message||"Không tải được dữ liệu chấm công")).finally(()=>setLoading(false))},[loadToday]);
 async function checkIn(){if(busy)return;setBusy(true);setError("");setMessage("");try{const r=await employeeApi.attendanceCheckIn({scheduleId:data.schedule.scheduleId,note:""});setMessage(r.message);await loadToday()}catch(e){setError(e.response?.data?.message||"Không thể chấm công vào")}finally{setBusy(false)}}
 async function checkOut(){if(busy)return;setBusy(true);setError("");setMessage("");try{const r=await employeeApi.attendanceCheckOut({scheduleId:data.schedule.scheduleId,note:""});setMessage(r.message);setConfirmOut(false);await loadToday()}catch(e){setError(e.response?.data?.message||"Không thể chấm công ra");setConfirmOut(false)}finally{setBusy(false)}}
 if(loading)return <section className="emp-card emp-empty"><FiClock/><div>Đang tải ca làm hôm nay...</div></section>;
 const {employee,schedule,attendance}=data||{};
 return <div className="attendance-page">
  {message&&<div className="emp-success">{message}</div>}{error&&<div className="emp-error">{error}</div>}
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
