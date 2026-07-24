import { useEffect, useState } from "react";
import { FiClock } from "react-icons/fi";
import { employeeApi } from "../../api/services";
import { shortDate, time } from "../../utils/employeeFormat";
export default function AttendancePage(){
  const [data,setData]=useState(null),[error,setError]=useState("");
  useEffect(()=>{employeeApi.attendance().then(r=>setData(r.data)).catch(e=>setError(e.response?.data?.message||"Không tải được chấm công"))},[]);
  const start=data?.schedule?.startTime,late=data?.checkIn&&start&&time(data.checkIn)>time(start);
  const duration=data?.checkIn&&data?.checkOut?Math.max(0,(new Date(data.checkOut)-new Date(data.checkIn))/36e5):null;
  return <div>{error&&<div className="emp-error">{error}</div>}
    <section className="emp-card"><span className={`emp-badge ${data?.checkIn?"success":"warn"}`}>{data?.checkIn?(late?"Đi trễ":"Đúng giờ"):"Chưa chấm công"}</span><h2 style={{margin:"14px 0 5px"}}>{data?.schedule?.shiftName||"Hôm nay chưa có lịch"}</h2><p className="emp-muted">{start?`${time(start)} – ${time(data.schedule.endTime)}`:"Dữ liệu từ hệ thống chấm công"}</p>
      <div className="emp-time-row"><div><small>Vào ca</small><strong>{time(data?.checkIn)}</strong></div><span className="emp-time-line"/><div><small>Ra ca</small><strong>{time(data?.checkOut)}</strong></div></div>
      <p className="emp-muted" style={{marginTop:18}}>Tổng thời gian: {duration===null?"Chưa hoàn tất":`${duration.toFixed(1)} giờ`}</p>
    </section>
    <div className="emp-section-head"><h2>Lịch sử gần đây</h2></div><section className="emp-card">{data?.recent?.length?<div className="emp-list">{data.recent.map((x,i)=><div className="emp-list-item" key={`${x.attendanceTime}-${i}`}><FiClock/><div><b>{x.attendanceType==="check_in"?"Chấm công vào":"Chấm công ra"}</b><small>{shortDate(x.attendanceTime)} · {time(x.attendanceTime)} · {x.source}</small></div></div>)}</div>:<div className="emp-empty"><FiClock/><div>Chưa có dữ liệu chấm công</div></div>}</section>
    {/* Dữ liệu thật được backend nhận từ API/máy chấm công; trình duyệt không trực tiếp đọc vân tay. */}
  </div>
}
