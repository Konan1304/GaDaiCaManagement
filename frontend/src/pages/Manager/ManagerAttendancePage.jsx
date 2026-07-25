import {useEffect,useMemo,useState} from "react";
import {FiAlertTriangle,FiCheckCircle,FiClock,FiEdit2,FiEye,FiSearch,FiUsers,FiX} from "react-icons/fi";
import {managerAttendanceApi} from "../../api/services";

const pad=value=>String(value).padStart(2,"0");
const localDate=value=>`${value.getFullYear()}-${pad(value.getMonth()+1)}-${pad(value.getDate())}`;
const initialDates=()=>{const now=new Date();return{from:`${now.getFullYear()}-${pad(now.getMonth()+1)}-01`,to:localDate(now)}};
const time=value=>value?String(value).slice(11,16):"—";
const date=value=>value?value.split("-").reverse().join("/"):"—";
const minutes=value=>value==null?"—":`${Math.floor(Number(value)/60)} giờ ${Number(value)%60} phút`;
const toInput=value=>value?String(value).slice(0,16):"";
const statusLabel={not_checked_in:"Chưa chấm công",working:"Đang làm việc",completed:"Hoàn thành",late:"Đi trễ",early_leave:"Về sớm",missing_checkout:"Thiếu giờ ra"};

function AttendanceModal({row,onClose,onSaved}){
  const [editing,setEditing]=useState(!row.attendanceId);
  const [form,setForm]=useState({checkInTime:toInput(row.checkInTime),checkOutTime:toInput(row.checkOutTime),reason:""});
  const [error,setError]=useState(""),[saving,setSaving]=useState(false);
  const save=async event=>{event.preventDefault();setError("");setSaving(true);try{
    const response=row.attendanceId?await managerAttendanceApi.update(row.attendanceId,form):await managerAttendanceApi.manual({...form,scheduleId:row.scheduleId});
    onSaved(response);
  }catch(err){setError(err.response?.data?.message||"Không thể lưu chấm công.");setSaving(false)}};
  return <div className="manager-modal-backdrop" onMouseDown={event=>event.target===event.currentTarget&&onClose()}>
    <div className="employee-modal attendance-modal">
      <header><div><h2>Chi tiết chấm công</h2><p>{row.fullName} · {row.employeeCode}</p></div><button onClick={onClose}><FiX/></button></header>
      {error&&<div className="manager-form-error">{error}</div>}
      <section className="attendance-detail-grid">
        <div><small>Nhân viên</small><b>{row.fullName}</b><span>{row.positionName}</span></div>
        <div><small>Chi nhánh</small><b>{row.branchName}</b><span>{row.employeeCode}</span></div>
        <div><small>Ngày làm</small><b>{date(row.workDate)}</b><span>{row.shiftName} ({row.shiftCode})</span></div>
        <div><small>Giờ ca</small><b>{row.shiftStartTime} – {row.shiftEndTime}</b><span>{row.isTest?"Dữ liệu kiểm thử":"Dữ liệu thực"}</span></div>
        <div><small>Giờ vào / ra</small><b>{time(row.checkInTime)} – {time(row.checkOutTime)}</b><span>{minutes(row.workedMinutes)}</span></div>
        <div><small>Đi trễ / về sớm</small><b>{row.lateMinutes||0} / {row.earlyLeaveMinutes||0} phút</b><span>{statusLabel[row.status]}</span></div>
        {(row.note||row.adjustmentReason)&&<div className="wide"><small>Ghi chú / lý do điều chỉnh</small><b>{row.adjustmentReason||row.note}</b><span>{row.updatedByName?`Cập nhật bởi ${row.updatedByName}`:""}</span></div>}
      </section>
      {editing?<form onSubmit={save} className="attendance-edit-form">
        <label>Giờ vào *<input type="datetime-local" required value={form.checkInTime} onChange={e=>setForm({...form,checkInTime:e.target.value})}/></label>
        <label>Giờ ra<input type="datetime-local" value={form.checkOutTime} onChange={e=>setForm({...form,checkOutTime:e.target.value})}/></label>
        <label className="wide">Lý do chỉnh sửa *<textarea required value={form.reason} onChange={e=>setForm({...form,reason:e.target.value})} placeholder="Ví dụ: Nhân viên quên chấm công ra"/></label>
        <footer><button type="button" className="btn btn-light" onClick={()=>setEditing(false)}>Hủy</button><button disabled={saving} className="btn btn-yellow">{saving?"Đang lưu...":"Lưu chấm công"}</button></footer>
      </form>:<footer><button className="btn btn-light" onClick={onClose}>Đóng</button><button className="btn btn-yellow" onClick={()=>setEditing(true)}><FiEdit2/> Chỉnh sửa</button></footer>}
    </div>
  </div>;
}

export default function ManagerAttendancePage(){
  const dates=useMemo(initialDates,[]);
  const [filters,setFilters]=useState({...dates,branchId:"",employeeId:"",positionId:"",status:"",dataType:"all",search:""});
  const [applied,setApplied]=useState(filters),[page,setPage]=useState(1);
  const [data,setData]=useState({items:[],summary:{},pagination:{page:1,totalPages:1,total:0}});
  const [options,setOptions]=useState({branches:[],employees:[],positions:[]});
  const [loading,setLoading]=useState(true),[error,setError]=useState(""),[success,setSuccess]=useState(""),[selected,setSelected]=useState(null);
  const load=async()=>{setLoading(true);setError("");try{const response=await managerAttendanceApi.list({...applied,page,limit:20});setData(response.data)}catch(err){setError(err.response?.data?.message||"Không thể tải dữ liệu chấm công.")}finally{setLoading(false)}};
  useEffect(()=>{managerAttendanceApi.options().then(response=>setOptions(response.data)).catch(()=>{})},[]);
  useEffect(()=>{load()},[applied,page]);
  const apply=event=>{event.preventDefault();setPage(1);setApplied({...filters})};
  const today=()=>{const value=localDate(new Date()),next={...filters,from:value,to:value};setFilters(next);setPage(1);setApplied(next)};
  const saved=response=>{setSelected(null);setSuccess(response.message+(response.data?.payrollLocked?" Kỳ lương đã chốt nên bảng lương cũ không tự thay đổi.":""));load()};
  const employees=options.employees.filter(item=>!filters.branchId||String(item.branchId)===String(filters.branchId)),summary=data.summary||{};
  return <div className="manager-attendance-page">
    <div className="section-title"><div><h1>Quản lý chấm công</h1><p>Theo dõi giờ vào, giờ ra và thời gian làm việc của nhân viên.</p></div></div>
    {success&&<div className="manager-form-success">{success}</div>}{error&&<div className="manager-form-error">{error}</div>}
    <form className="attendance-filters" onSubmit={apply}>
      <label>Từ ngày<input type="date" value={filters.from} onChange={e=>setFilters({...filters,from:e.target.value})}/></label>
      <label>Đến ngày<input type="date" value={filters.to} onChange={e=>setFilters({...filters,to:e.target.value})}/></label>
      <label>Chi nhánh<select value={filters.branchId} onChange={e=>setFilters({...filters,branchId:e.target.value,employeeId:""})}><option value="">Tất cả chi nhánh</option>{options.branches.map(x=><option key={x.branchId} value={x.branchId}>{x.branchName}</option>)}</select></label>
      <label>Nhân viên<select value={filters.employeeId} onChange={e=>setFilters({...filters,employeeId:e.target.value})}><option value="">Tất cả nhân viên</option>{employees.map(x=><option key={x.employeeId} value={x.employeeId}>{x.fullName} ({x.employeeCode})</option>)}</select></label>
      <label>Vị trí<select value={filters.positionId} onChange={e=>setFilters({...filters,positionId:e.target.value})}><option value="">Tất cả vị trí</option>{options.positions.map(x=><option key={x.positionId} value={x.positionId}>{x.positionName}</option>)}</select></label>
      <label>Trạng thái<select value={filters.status} onChange={e=>setFilters({...filters,status:e.target.value})}><option value="">Tất cả</option>{Object.entries(statusLabel).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>
      <label>Loại dữ liệu<select value={filters.dataType} onChange={e=>setFilters({...filters,dataType:e.target.value})}><option value="all">Tất cả</option><option value="real">Dữ liệu thật</option><option value="test">Dữ liệu test</option></select></label>
      <label className="attendance-search">Tìm nhân viên<span><FiSearch/><input value={filters.search} onChange={e=>setFilters({...filters,search:e.target.value})} placeholder="Tên hoặc mã nhân viên"/></span></label>
      <div className="attendance-filter-actions"><button type="button" className="btn btn-light" onClick={today}>Hôm nay</button><button className="btn btn-yellow">Lọc</button></div>
    </form>
    <div className="attendance-stat-grid">
      <article><FiUsers/><span><small>Có lịch</small><b>{summary.scheduled||0}</b></span></article>
      <article><FiClock/><span><small>Đã chấm vào</small><b>{summary.checkedIn||0}</b></span></article>
      <article><FiCheckCircle/><span><small>Đã hoàn thành</small><b>{summary.completed||0}</b></span></article>
      <article><FiAlertTriangle/><span><small>Trễ hoặc thiếu chấm công</small><b>{summary.attention||0}</b></span></article>
    </div>
    <div className="table-wrap attendance-table-wrap"><table className="data-table attendance-manager-table"><thead><tr><th>Ngày</th><th>Nhân viên</th><th>Vị trí / Chi nhánh</th><th>Ca làm</th><th>Giờ vào</th><th>Giờ ra</th><th>Tổng thời gian</th><th>Đi trễ</th><th>Về sớm</th><th>Trạng thái</th><th>Thao tác</th></tr></thead><tbody>
      {loading?<tr><td colSpan="11" className="payroll-empty">Đang tải dữ liệu...</td></tr>:data.items.length?data.items.map(row=><tr key={row.attendanceId||`schedule-${row.scheduleId}`} className={row.isTest?"attendance-test-row":""}>
        <td><b>{date(row.workDate)}</b>{row.isTest&&<small className="attendance-test-badge">Test</small>}</td><td><b>{row.fullName}</b><small>{row.employeeCode}</small></td>
        <td><b>{row.positionName}</b><small>{row.branchName}</small></td><td><b>{row.shiftName}</b><small>{row.shiftStartTime} – {row.shiftEndTime}</small></td>
        <td>{time(row.checkInTime)}</td><td>{time(row.checkOutTime)}</td><td>{minutes(row.workedMinutes)}</td>
        <td>{row.lateMinutes>0?<span className="attendance-issue late">Trễ {row.lateMinutes} phút</span>:"—"}</td><td>{row.earlyLeaveMinutes>0?<span className="attendance-issue early">Sớm {row.earlyLeaveMinutes} phút</span>:"—"}</td>
        <td><span className={`attendance-status ${row.status}`}>{statusLabel[row.status]}</span>{row.status==="completed"&&row.lateMinutes>0&&<small className="attendance-sub-badge">Đi trễ</small>}</td>
        <td><div className="attendance-actions"><button title="Xem chi tiết" onClick={()=>setSelected(row)}><FiEye/></button><button title="Chỉnh sửa" onClick={()=>setSelected(row)}><FiEdit2/></button></div></td>
      </tr>):<tr><td colSpan="11" className="payroll-empty">Không có lịch chấm công phù hợp</td></tr>}
    </tbody></table></div>
    <div className="attendance-pagination"><span>Hiển thị {data.items.length} trong {data.pagination.total||0} dòng</span><div><button disabled={page<=1} onClick={()=>setPage(page-1)}>‹</button><b>{page}</b><button disabled={page>=data.pagination.totalPages} onClick={()=>setPage(page+1)}>›</button></div></div>
    {selected&&<AttendanceModal row={selected} onClose={()=>setSelected(null)} onSaved={saved}/>}
  </div>;
}
