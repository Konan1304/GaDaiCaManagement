import {useEffect,useMemo,useRef,useState} from "react";
import {FiCalendar,FiChevronDown,FiChevronLeft,FiChevronRight,FiClock,FiMapPin,FiUsers} from "react-icons/fi";
import {employeeApi} from "../../api/services";
import {dateKey,time} from "../../utils/employeeFormat";

const modes=[["day","Ngày"],["week","Tuần"],["month","Tháng"]];
const weekLabels=["Th 2","Th 3","Th 4","Th 5","Th 6","Th 7","CN"];
const shortDays=["CN","Th 2","Th 3","Th 4","Th 5","Th 6","Th 7"];
const statusLabels={scheduled:"Đã xếp",working:"Đang làm",completed:"Đã hoàn thành",cancelled:"Đã hủy"};
const localDate=key=>new Date(`${key}T00:00:00`);
const addDays=(date,amount)=>{const value=new Date(date);value.setDate(value.getDate()+amount);return value};
const mondayOf=date=>addDays(new Date(date.getFullYear(),date.getMonth(),date.getDate()),-((date.getDay()+6)%7));
const monthTitle=date=>`tháng ${date.getMonth()+1}, ${date.getFullYear()}`;
const shiftColor=item=>item.status==="cancelled"?"cancelled":item.status==="completed"?"completed":String(item.shiftCode||"").toLowerCase();

export default function MySchedulePage(){
 const today=useMemo(()=>new Date(),[]);
 const [mode,setMode]=useState("month"),[cursor,setCursor]=useState(()=>new Date(today.getFullYear(),today.getMonth(),1));
 const [selected,setSelected]=useState(()=>dateKey(today)),[items,setItems]=useState([]),[loading,setLoading]=useState(true);
 const [error,setError]=useState(""),[picker,setPicker]=useState(false);
 const agendaRefs=useRef({});

 const range=useMemo(()=>{
  if(mode==="day"){const key=dateKey(localDate(selected));return{from:key,to:key}}
  if(mode==="week"){const start=mondayOf(localDate(selected));return{from:dateKey(start),to:dateKey(addDays(start,6))}}
  return{from:dateKey(new Date(cursor.getFullYear(),cursor.getMonth(),1)),to:dateKey(new Date(cursor.getFullYear(),cursor.getMonth()+1,0))}
 },[mode,cursor,selected]);

 useEffect(()=>{
  let active=true;setLoading(true);setError("");
  employeeApi.schedules(range.from,range.to).then(response=>{if(active)setItems(response.data||[])})
   .catch(e=>{if(active)setError(e.response?.data?.message||"Không tải được lịch làm")})
   .finally(()=>{if(active)setLoading(false)});
  return()=>{active=false};
 },[range.from,range.to]);

 const byDate=useMemo(()=>items.reduce((map,item)=>{const key=dateKey(item.workDate);(map[key]??=[]).push(item);return map},{}),[items]);
 const monthCells=useMemo(()=>{
  const first=new Date(cursor.getFullYear(),cursor.getMonth(),1),last=new Date(cursor.getFullYear(),cursor.getMonth()+1,0);
  const leading=(first.getDay()+6)%7;
  return [...Array(leading).fill(null),...Array.from({length:last.getDate()},(_,index)=>new Date(cursor.getFullYear(),cursor.getMonth(),index+1))];
 },[cursor]);
 const weekDays=useMemo(()=>{const start=mondayOf(localDate(selected));return Array.from({length:7},(_,index)=>addDays(start,index))},[selected]);
 const visibleItems=useMemo(()=>{
  if(mode==="month")return items;
  return byDate[selected]||[];
 },[mode,items,byDate,selected]);
 const grouped=useMemo(()=>visibleItems.reduce((map,item)=>{const key=dateKey(item.workDate);(map[key]??=[]).push(item);return map},{}),[visibleItems]);

 function changePeriod(amount){
  if(mode==="month"){const next=new Date(cursor.getFullYear(),cursor.getMonth()+amount,1);setCursor(next);setSelected(dateKey(next))}
  else if(mode==="week")setSelected(dateKey(addDays(localDate(selected),amount*7)));
  else setSelected(dateKey(addDays(localDate(selected),amount)));
 }
 function chooseMonth(month,year){const next=new Date(year,month,1);setCursor(next);setSelected(dateKey(next));setPicker(false)}
 function selectCalendarDate(key,hasSchedule){
  setSelected(key);
  if(!hasSchedule)return;
  window.requestAnimationFrame(()=>agendaRefs.current[key]?.scrollIntoView({behavior:"smooth",block:"start"}));
 }

 return <div className="schedule-page">
  {error&&<div className="emp-error">{error}</div>}
  <section className="schedule-control">
   <button className="schedule-month-button" onClick={()=>setPicker(true)}>{monthTitle(mode==="month"?cursor:localDate(selected))}<FiChevronDown/></button>
   <div className="schedule-segments">{modes.map(([key,label])=><button className={mode===key?"active":""} key={key} onClick={()=>setMode(key)}>{label}</button>)}</div>
  </section>

  {mode==="month"&&<section className="schedule-calendar-card">
   <div className="schedule-calendar-nav"><button onClick={()=>changePeriod(-1)} aria-label="Tháng trước"><FiChevronLeft/></button><button onClick={()=>changePeriod(1)} aria-label="Tháng sau"><FiChevronRight/></button></div>
   <div className="schedule-week-head">{weekLabels.map((label,index)=><b className={index>4?"weekend":""} key={label}>{label}</b>)}</div>
   <div className="schedule-month-grid">{monthCells.map((date,index)=>{
    if(!date)return <span key={`blank-${index}`}/>;
    const key=dateKey(date),dayItems=byDate[key]||[],isToday=key===dateKey(today),isSelected=key===selected;
    return <button key={key} className={`${isToday?"today":""} ${isSelected?"selected":""} ${dayItems.length?"has-schedule":""}`} onClick={()=>selectCalendarDate(key,dayItems.length>0)} aria-label={`${date.toLocaleDateString("vi-VN")}${dayItems.length?`, có ${dayItems.length} ca làm`:", không có ca làm"}`}>
     <span>{date.getDate()}</span><i className="schedule-dots">{dayItems.slice(0,3).map(item=><em className={`shift-${shiftColor(item)}`} key={item.scheduleId}/>)}</i>
     {dayItems.length>3&&<small>+{dayItems.length-3}</small>}
    </button>
   })}</div>
  </section>}

  {mode==="week"&&<section className="schedule-week-card">
   <div className="schedule-range-nav"><button onClick={()=>changePeriod(-1)}><FiChevronLeft/></button><b>{weekDays[0].toLocaleDateString("vi-VN")} – {weekDays[6].toLocaleDateString("vi-VN")}</b><button onClick={()=>changePeriod(1)}><FiChevronRight/></button></div>
   <button className="schedule-current-button" onClick={()=>setSelected(dateKey(today))}>Tuần hiện tại</button>
   <div className="schedule-week-strip">{weekDays.map(date=>{const key=dateKey(date),dayItems=byDate[key]||[];return <button className={key===selected?"selected":""} onClick={()=>setSelected(key)} key={key}><small>{shortDays[date.getDay()]}</small><b>{date.getDate()}</b><i className="schedule-dots">{dayItems.slice(0,2).map(item=><em className={`shift-${shiftColor(item)}`} key={item.scheduleId}/>)}</i></button>})}</div>
  </section>}

  {mode==="day"&&<section className="schedule-day-nav"><button onClick={()=>changePeriod(-1)}><FiChevronLeft/></button><div><small>{shortDays[localDate(selected).getDay()]}</small><b>{localDate(selected).toLocaleDateString("vi-VN",{day:"2-digit",month:"long",year:"numeric"})}</b></div><button onClick={()=>changePeriod(1)}><FiChevronRight/></button></section>}

  {loading?<div className="schedule-loading"><i/><i/><i/></div>:<section className="schedule-agenda">
   {Object.keys(grouped).sort().map(key=><div className={`schedule-date-group ${key===selected?"selected":""}`} key={key} ref={node=>{if(node)agendaRefs.current[key]=node;else delete agendaRefs.current[key]}}>
    <div className="schedule-date-label"><span>{shortDays[localDate(key).getDay()]}, {localDate(key).toLocaleDateString("vi-VN",{day:"2-digit",month:"2-digit"})}</span><i/></div>
    {grouped[key].map(item=><article className={`schedule-shift-card shift-${shiftColor(item)}`} key={item.scheduleId}>
     <i className="schedule-shift-bar"/><div className="schedule-shift-body"><div className="schedule-shift-title"><div><h3>{item.shiftName||`Ca ${item.shiftCode}`}</h3><span>Mã ca {item.shiftCode}</span></div><b className={`schedule-status status-${item.status}`}>{statusLabels[item.status]||item.status}</b></div>
      <p><FiClock/><span>{time(item.startTime)} – {time(item.endTime)}</span></p>
      <p><FiMapPin/><span>Vị trí: <b>{item.workPosition||item.positionName}</b></span></p>
      <p><FiMapPin/><span>Chi nhánh: <b>{item.branchName}</b></span></p>
      <div className="schedule-coworkers"><div className="schedule-coworkers-title"><FiUsers/><span>Làm cùng ca <b>{item.coworkers?.length||0} nhân viên</b></span></div>{item.coworkers?.length?<div className="schedule-coworker-list">{item.coworkers.map(person=><div className="schedule-coworker" key={person.employeeId}><span>{person.fullName?.split(" ").map(part=>part[0]).slice(-2).join("")||"NV"}</span><div><b>{person.fullName}</b><small>{person.positionName} · Ca {person.shiftCode} ({time(person.startTime)}–{time(person.endTime)})</small></div></div>)}</div>:<small className="schedule-no-coworker">Ca này chưa có nhân viên khác được xếp cùng.</small>}</div>
      {item.note&&<p className="schedule-note">{item.note}</p>}
     </div>
    </article>)}
   </div>)}
   {!Object.keys(grouped).length&&<div className="schedule-empty"><FiCalendar/><b>{items.length?"Không có lịch làm trong ngày này":"Quản lý chưa công bố lịch làm"}</b><span>Lịch chính thức sẽ xuất hiện tại đây sau khi được công bố.</span></div>}
  </section>}

  {picker&&<div className="schedule-picker-backdrop" onMouseDown={()=>setPicker(false)}><div className="schedule-picker" onMouseDown={event=>event.stopPropagation()}><h3>Chọn tháng và năm</h3><div><select defaultValue={(mode==="month"?cursor:localDate(selected)).getMonth()} id="schedule-month-select">{Array.from({length:12},(_,index)=><option value={index} key={index}>Tháng {index+1}</option>)}</select><select defaultValue={(mode==="month"?cursor:localDate(selected)).getFullYear()} id="schedule-year-select">{Array.from({length:9},(_,index)=>today.getFullYear()-4+index).map(year=><option key={year}>{year}</option>)}</select></div><footer><button onClick={()=>setPicker(false)}>Hủy</button><button onClick={()=>chooseMonth(Number(document.getElementById("schedule-month-select").value),Number(document.getElementById("schedule-year-select").value))}>Áp dụng</button></footer></div></div>}
 </div>;
}
