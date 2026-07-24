import {useEffect,useMemo,useState} from "react";
import {useNavigate,useParams} from "react-router-dom";
import {scheduleRegistrationApi} from "../../api/services";

const dayNames=["CN","T2","T3","T4","T5","T6","T7"];
const dateKey=value=>{
  if(!(value instanceof Date))return String(value||"").slice(0,10);
  const y=value.getFullYear(),m=String(value.getMonth()+1).padStart(2,"0"),d=String(value.getDate()).padStart(2,"0");
  return `${y}-${m}-${d}`;
};
const dateRange=(startValue,endValue)=>{
  const start=new Date(`${dateKey(startValue)}T00:00:00`),end=new Date(`${dateKey(endValue)}T00:00:00`);
  const length=Math.floor((end-start)/864e5)+1;
  return Array.from({length},(_,index)=>{const date=new Date(start);date.setDate(start.getDate()+index);return date});
};

export default function ScheduleBuilderPage(){
  const {periodId}=useParams(),navigate=useNavigate();
  const [data,setData]=useState(null),[assignments,setAssignments]=useState({});
  const [message,setMessage]=useState(""),[error,setError]=useState(""),[saving,setSaving]=useState(false);

  useEffect(()=>{
    scheduleRegistrationApi.builder(periodId).then(response=>{
      const payload=response.data,registrationMap={},draftMap={};
      payload.registrations.forEach(item=>registrationMap[`${item.employeeId}_${item.workDate}`]=item.shiftCode);
      payload.draftSchedules.forEach(item=>draftMap[`${item.employeeId}_${item.workDate}`]=item.shiftCode);
      setData({...payload,registrationMap});
      setAssignments(Object.keys(draftMap).length?draftMap:registrationMap);
    }).catch(e=>setError(e.response?.data?.message||"Không tải được dữ liệu xếp lịch"));
  },[periodId]);

  const dates=useMemo(()=>data?dateRange(data.period.startDate,data.period.endDate):[],[data]);
  const schedules=()=>Object.entries(assignments).filter(([,shiftCode])=>shiftCode).map(([key,shiftCode])=>{
    const separator=key.indexOf("_"),employeeId=Number(key.slice(0,separator)),workDate=key.slice(separator+1);
    const employee=data.employees.find(item=>Number(item.employeeId)===employeeId);
    return {employeeId,workDate,shiftCode,workPosition:employee?.positionName||"",note:""};
  });
  const run=async publish=>{
    setSaving(true);setMessage("");setError("");
    try{
      let response;
      if(publish){
        await scheduleRegistrationApi.saveBuilder(periodId,schedules());
        response=await scheduleRegistrationApi.publishBuilder(periodId);
      }else response=await scheduleRegistrationApi.saveBuilder(periodId,schedules());
      setMessage(publish?`${response.message}. Nhân viên đã có thể xem lịch làm.`:response.message);
      if(publish)setData(value=>({...value,period:{...value.period,status:"published"},draftSchedules:schedules()}));
    }catch(e){setError(e.response?.data?.message||"Không thể lưu lịch")}
    finally{setSaving(false)}
  };

  if(!data)return <section className="card employee-table-empty">Đang tải trình xếp lịch...</section>;
  return <section className="card registration-sheet">
    <div className="section-title"><div><h2>Xếp lịch chính thức</h2><p>{data.period.title} · Lịch chỉ hiện cho nhân viên sau khi được công bố.</p></div><div>
      <button className="btn btn-light" onClick={()=>navigate(-1)}>Quay lại</button>{" "}
      <button className="btn btn-light" disabled={saving} onClick={()=>run(false)}>Lưu bản nháp</button>{" "}
      <button className="btn btn-primary" disabled={saving} onClick={()=>run(true)}>Lưu &amp; Công bố</button>
    </div></div>
    {message&&<div className="manager-form-success">{message}</div>}
    {error&&<div className="manager-form-error">{error}</div>}
    <div className="schedule-sheet-wrap"><table className="schedule-sheet builder"><thead><tr><th>Nhân viên</th>
      {dates.map(date=><th key={dateKey(date)}>{dayNames[date.getDay()]}<small>{date.toLocaleDateString("vi-VN",{day:"2-digit",month:"2-digit"})}</small></th>)}
    </tr></thead><tbody>{data.employees.map(employee=><tr key={employee.employeeId}><th><b>{employee.fullName}</b><small>{employee.positionName}</small></th>
      {dates.map(date=>{const key=`${employee.employeeId}_${dateKey(date)}`,registered=data.registrationMap[key]||"",assigned=assignments[key]||"";
        return <td className={assigned!==registered&&registered?"schedule-mismatch":""} key={key}>
          <select value={assigned} onChange={event=>setAssignments(value=>({...value,[key]:event.target.value}))}>
            <option value="">Nghỉ</option>{data.shifts.map(shift=><option key={shift.shiftId} value={shift.shiftCode}>{shift.shiftCode}</option>)}
          </select>
          <small>ĐK: {registered||"—"}</small>
          <small>Xếp: {assigned||"Nghỉ"}</small>
        </td>})}
    </tr>)}</tbody></table></div>
  </section>;
}
