import {useEffect,useMemo,useState} from "react";
import {FiArrowLeft,FiCheckCircle,FiCreditCard,FiSave} from "react-icons/fi";
import {useNavigate,useParams,useSearchParams} from "react-router-dom";
import {payrollApi} from "../../api/services";

const money=value=>Number(value||0).toLocaleString("vi-VN")+"đ";
const fields=[["parkingAllowance","Phụ cấp gửi xe"],["mealAllowance","Phụ cấp cơm"],["otherAllowance","Phụ cấp khác"],["bonus","Thưởng"],["uniformDeduction","Đồng phục"],["salaryAdvance","Tạm ứng"],["otherDeduction","Khoản trừ khác"]];
const statusName={draft:"Nháp",confirmed:"Đã xác nhận",paid:"Đã trả"};
export default function PayrollDetailPage(){
 const {employeeId}=useParams(),navigate=useNavigate(),[params]=useSearchParams(),month=params.get("month")||new Date().toISOString().slice(0,7);
 const [data,setData]=useState(null),[form,setForm]=useState({}),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[message,setMessage]=useState(""),[error,setError]=useState("");
 const load=()=>payrollApi.detail(employeeId,month).then(r=>{setData(r.data);setForm(Object.fromEntries([...fields.map(([key])=>[key,r.data[key]||0]),["hourlyRate",r.data.hourlyRate||26000],["note",r.data.note||""]]))}).catch(e=>setError(e.response?.data?.message||"Không tải được chi tiết lương")).finally(()=>setLoading(false));
 useEffect(()=>{load()},[employeeId,month]);
 const calc=useMemo(()=>{if(!data)return{};const base=Math.round(Number(data.totalWorkHours||0)*Number(form.hourlyRate||0)),allowance=Number(form.parkingAllowance||0)+Number(form.mealAllowance||0)+Number(form.otherAllowance||0)+Number(form.bonus||0),deduction=Number(form.uniformDeduction||0)+Number(form.salaryAdvance||0)+Number(form.otherDeduction||0);return{base,allowance,deduction,net:base+allowance-deduction}},[data,form]);
 async function save(){setBusy(true);setError("");setMessage("");try{const r=await payrollApi.save(employeeId,month,form);setMessage(r.message);await load()}catch(e){setError(e.response?.data?.message||"Không thể lưu bảng lương")}finally{setBusy(false)}}
 async function transition(action){setBusy(true);setError("");setMessage("");try{const r=await payrollApi.transition(employeeId,month,action);setMessage(r.message);await load()}catch(e){setError(e.response?.data?.message||"Không thể cập nhật trạng thái")}finally{setBusy(false)}}
 if(loading)return <div className="card payroll-empty">Đang tải chi tiết bảng lương...</div>;
 if(!data)return <div className="manager-form-error">{error||"Không tìm thấy bảng lương"}</div>;
 const editable=data.status==="draft";
 return <section className="payroll-detail"><button className="payroll-back" onClick={()=>navigate(`/manager/payrolls?month=${month}`)}><FiArrowLeft/> Quay lại bảng lương</button>
  <div className="payroll-detail-head"><div><h1>{data.fullName}</h1><p>{data.employeeCode} · {data.positionName} · {data.branchName} · Tháng {month.split("-").reverse().join("/")}</p></div><span className={`payroll-status ${data.status}`}>{statusName[data.status]}</span></div>
  {message&&<div className="manager-form-success">{message}</div>}{error&&<div className="manager-form-error">{error}</div>}
  <div className="payroll-detail-grid"><div className="card payroll-days"><h2>Chấm công thực tế</h2><table className="data-table"><thead><tr><th>Ngày</th><th>Giờ vào</th><th>Giờ ra</th><th>Tổng giờ</th></tr></thead><tbody>{data.days.length?data.days.map(day=><tr key={day.workDate}><td>{new Date(`${day.workDate}T00:00:00`).toLocaleDateString("vi-VN")}</td><td>{new Date(day.checkIn).toLocaleTimeString("vi-VN",{hour:"2-digit",minute:"2-digit"})}</td><td>{new Date(day.checkOut).toLocaleTimeString("vi-VN",{hour:"2-digit",minute:"2-digit"})}</td><td><b>{Number(day.totalHours).toFixed(2)} giờ</b></td></tr>):<tr><td colSpan="4" className="payroll-empty">Tháng này chưa có lượt chấm công vào/ra hợp lệ</td></tr>}</tbody></table></div>
  <aside className="card payroll-editor"><h2>Tổng hợp lương</h2><div className="payroll-summary-row"><span>Ngày đã làm</span><b>{data.totalWorkDays} ngày</b></div><div className="payroll-summary-row"><span>Tổng giờ</span><b>{Number(data.totalWorkHours).toFixed(2)} giờ</b></div><label>Lương giờ<input disabled={!editable} type="number" min="0" value={form.hourlyRate} onChange={e=>setForm({...form,hourlyRate:e.target.value})}/></label><div className="payroll-summary-row strong"><span>Lương chính</span><b>{money(calc.base)}</b></div>{fields.map(([key,label])=><label key={key}>{label}<input disabled={!editable} type="number" min="0" value={form[key]} onChange={e=>setForm({...form,[key]:e.target.value})}/></label>)}<label>Ghi chú<textarea disabled={!editable} value={form.note} onChange={e=>setForm({...form,note:e.target.value})}/></label><div className="payroll-summary-row net"><span>Tổng thực nhận</span><b>{money(calc.net)}</b></div>
   <div className="payroll-detail-actions">{editable&&<><button disabled={busy} className="btn btn-light" onClick={save}><FiSave/> Lưu</button><button disabled={busy} className="btn btn-primary" onClick={()=>transition("confirm")}><FiCheckCircle/> Xác nhận</button></>}{data.status==="confirmed"&&<button disabled={busy} className="btn btn-primary" onClick={()=>transition("paid")}><FiCreditCard/> Đánh dấu đã trả</button>}</div></aside></div>
 </section>
}
