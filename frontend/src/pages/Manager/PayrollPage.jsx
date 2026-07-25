import {useEffect,useMemo,useState} from "react";
import {FiEye,FiRefreshCw,FiSearch} from "react-icons/fi";
import {useNavigate} from "react-router-dom";
import {managerEmployeeApi,payrollApi} from "../../api/services";

const currentMonth=()=>new Date().toISOString().slice(0,7);
const money=value=>Number(value||0).toLocaleString("vi-VN")+"đ";
const statusName={draft:"Nháp",confirmed:"Đã xác nhận",paid:"Đã trả"};

export default function PayrollPage(){
 const navigate=useNavigate(),[month,setMonth]=useState(currentMonth()),[branchId,setBranchId]=useState(""),[search,setSearch]=useState("");
 const [branches,setBranches]=useState([]),[rows,setRows]=useState([]),[loading,setLoading]=useState(false),[busy,setBusy]=useState(false),[message,setMessage]=useState(""),[error,setError]=useState("");
 const load=()=>{setLoading(true);setError("");return payrollApi.list({month,branchId:branchId||undefined}).then(r=>setRows(r.data||[])).catch(e=>setError(e.response?.data?.message||"Không tải được bảng lương")).finally(()=>setLoading(false))};
 useEffect(()=>{managerEmployeeApi.branches().then(r=>setBranches(r.data||[])).catch(()=>{})},[]);
 useEffect(()=>{load()},[month,branchId]);
 const filtered=useMemo(()=>{const key=search.trim().toLocaleLowerCase("vi");return key?rows.filter(x=>`${x.employeeCode} ${x.fullName}`.toLocaleLowerCase("vi").includes(key)):rows},[rows,search]);
 async function calculate(){setBusy(true);setError("");setMessage("");try{const r=await payrollApi.calculate({month,branchId:branchId||undefined});setMessage(r.message);await load()}catch(e){setError(e.response?.data?.message||"Không thể tính lương")}finally{setBusy(false)}}
 return <section className="payroll-page">
  <div className="employee-page-title"><div><h1>Bảng lương nhân viên</h1><p>Tính theo giờ chấm công thực tế từ hệ thống.</p></div><button className="btn btn-primary" disabled={busy} onClick={calculate}><FiRefreshCw/>{busy?"Đang tính...":"Tính lương"}</button></div>
  <div className="payroll-tools"><label>Tháng<input type="month" value={month} onChange={e=>setMonth(e.target.value)}/></label><label>Chi nhánh<select value={branchId} onChange={e=>setBranchId(e.target.value)}><option value="">Tất cả chi nhánh</option>{branches.map(x=><option key={x.id} value={x.id}>{x.branchName}</option>)}</select></label><label className="payroll-search"><FiSearch/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Tìm mã hoặc tên nhân viên"/></label></div>
  {message&&<div className="manager-form-success">{message}</div>}{error&&<div className="manager-form-error">{error}</div>}
  <div className="card payroll-table-wrap"><table className="data-table payroll-table"><thead><tr><th>Mã NV</th><th>Họ tên</th><th>Ngày làm</th><th>Tổng giờ</th><th>Lương giờ</th><th>Lương chính</th><th>Phụ cấp</th><th>Khấu trừ</th><th>Thực nhận</th><th>Trạng thái</th><th>Thao tác</th></tr></thead><tbody>
   {loading?<tr><td colSpan="11" className="payroll-empty">Đang tải bảng lương...</td></tr>:filtered.length?filtered.map(row=><tr key={row.employeeId}><td><b>{row.employeeCode}</b></td><td><b>{row.fullName}</b><small>{row.positionName} · {row.branchName}</small></td><td>{row.totalWorkDays}</td><td>{Number(row.totalWorkHours).toFixed(2)}</td><td>{money(row.hourlyRate)}</td><td>{money(row.baseSalary)}</td><td className="payroll-plus">+{money(row.totalAllowance)}</td><td className="payroll-minus">-{money(row.totalDeduction)}</td><td className="payroll-net">{money(row.netSalary)}</td><td><span className={`payroll-status ${row.status}`}>{statusName[row.status]}</span></td><td><button className="payroll-view" onClick={()=>navigate(`/manager/payrolls/${row.employeeId}?month=${month}`)}><FiEye/> Chi tiết</button></td></tr>):<tr><td colSpan="11" className="payroll-empty">Không có nhân viên phù hợp</td></tr>}
  </tbody></table></div>
 </section>
}
