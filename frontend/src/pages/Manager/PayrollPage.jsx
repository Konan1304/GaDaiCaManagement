import {useEffect,useMemo,useState} from "react";
import {FiChevronLeft,FiEye,FiGitBranch,FiRefreshCw,FiSearch,FiUsers} from "react-icons/fi";
import {useNavigate} from "react-router-dom";
import {managerEmployeeApi,managerOperationApi,payrollApi} from "../../api/services";

const currentMonth=()=>new Date().toISOString().slice(0,7);
const isSandbox=import.meta.env.VITE_APP_ENV==="sandbox";
const money=value=>Number(value||0).toLocaleString("vi-VN")+"đ";
const statusName={draft:"Nháp",confirmed:"Đã xác nhận",paid:"Đã trả"};

export default function PayrollPage(){
 const navigate=useNavigate();
 const [month,setMonth]=useState(currentMonth()),[branchId,setBranchId]=useState(""),[branchSearch,setBranchSearch]=useState(""),[search,setSearch]=useState("");
 const [branches,setBranches]=useState([]),[rows,setRows]=useState([]),[loading,setLoading]=useState(false),[busy,setBusy]=useState(false),[message,setMessage]=useState(""),[error,setError]=useState("");
 const load=()=>{setLoading(true);setError("");return payrollApi.list({month,branchId:branchId||undefined}).then(r=>setRows(r.data||[])).catch(e=>setError(e.response?.data?.message||"Không tải được bảng lương")).finally(()=>setLoading(false))};

 useEffect(()=>{managerEmployeeApi.branches().then(r=>setBranches(r.data||[])).catch(()=>{})},[]);
 useEffect(()=>{if(!isSandbox)return;managerOperationApi.clock().then(r=>{const value=r.data?.businessDateTime||r.businessDateTime;const businessMonth=String(value||"").slice(0,7);if(/^\d{4}-\d{2}$/.test(businessMonth))setMonth(businessMonth)}).catch(()=>{})},[]);
 useEffect(()=>{load()},[month,branchId]);

 const selectedBranch=branches.find(x=>String(x.id)===String(branchId));
 const filtered=useMemo(()=>{const key=search.trim().toLocaleLowerCase("vi");return key?rows.filter(x=>`${x.employeeCode} ${x.fullName}`.toLocaleLowerCase("vi").includes(key)):rows},[rows,search]);
 const visibleBranches=useMemo(()=>{const key=branchSearch.trim().toLocaleLowerCase("vi");return branches.filter(x=>!key||`${x.branchName} ${x.branchCode||""} ${x.address||""}`.toLocaleLowerCase("vi").includes(key))},[branches,branchSearch]);
 const branchRows=id=>rows.filter(row=>String(row.branchId)===String(id));

 async function calculate(){setBusy(true);setError("");setMessage("");try{const r=await payrollApi.calculate({month,branchId});setMessage(r.message);await load()}catch(e){setError(e.response?.data?.message||"Không thể tính lương")}finally{setBusy(false)}}
 function openBranch(id){setBranchId(String(id));setSearch("");setMessage("");setError("")}
 function backToBranches(){setBranchId("");setSearch("");setMessage("");setError("")}

 if(!branchId)return <section className="payroll-page attendance-branch-overview">
  <div className="employee-page-title"><div><h1>Quản lý bảng lương</h1><p>Chọn chi nhánh để xem và tính lương nhân viên theo tháng.</p></div><div className="attendance-branch-count"><FiUsers/><b>{branches.length}</b><span>chi nhánh</span></div></div>
  <label className="attendance-branch-search"><FiSearch/><input value={branchSearch} onChange={e=>setBranchSearch(e.target.value)} placeholder="Tìm tên, mã hoặc địa chỉ chi nhánh"/></label>
  {error&&<div className="manager-form-error">{error}</div>}
  <div className="attendance-branch-cards">
   {visibleBranches.map(branch=>{const payrollRows=branchRows(branch.id);const total=payrollRows.reduce((sum,row)=>sum+Number(row.netSalary||0),0);return <article className="card" key={branch.id}>
    <header><span className="attendance-branch-icon"><FiGitBranch/></span><div><h2>{branch.branchName}</h2><p>{branch.branchCode||"Chưa có mã chi nhánh"}</p></div><small>{branch.status==="inactive"?"Ngừng hoạt động":"Đang hoạt động"}</small></header>
    <div className="attendance-branch-card-stats"><span><b>{payrollRows.length}</b><small>Nhân viên</small></span><span><b>{money(total)}</b><small>Lương tạm tính</small></span></div>
    <button className="btn btn-primary" onClick={()=>openBranch(branch.id)}>Xem bảng lương →</button>
   </article>})}
   {!visibleBranches.length&&!loading&&<div className="payroll-empty">Không tìm thấy chi nhánh phù hợp</div>}
  </div>
 </section>;

 return <section className="payroll-page">
  <button type="button" className="attendance-back-branches" onClick={backToBranches}><FiChevronLeft/> Tất cả chi nhánh</button>
  <span className="attendance-current-branch">{selectedBranch?.branchName||"Chi nhánh"}</span>
  <div className="employee-page-title"><div><h1>Bảng lương nhân viên</h1><p>Tính theo giờ chấm công thực tế của chi nhánh đã chọn.</p></div><button className="btn btn-primary" disabled={busy} onClick={calculate}><FiRefreshCw/>{busy?"Đang tính...":"Tính lương"}</button></div>
  <div className="payroll-tools"><label>Tháng<input type="month" value={month} onChange={e=>setMonth(e.target.value)}/></label><label>Chi nhánh<div className="attendance-branch-readonly">{selectedBranch?.branchName||"—"}</div></label><label className="payroll-search"><FiSearch/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Tìm mã hoặc tên nhân viên"/></label></div>
  {message&&<div className="manager-form-success">{message}</div>}{error&&<div className="manager-form-error">{error}</div>}
  <div className="card payroll-table-wrap"><table className="data-table payroll-table"><thead><tr><th>Mã NV</th><th>Họ tên</th><th>Ngày làm</th><th>Tổng giờ</th><th>Lương giờ</th><th>Lương chính</th><th>Phụ cấp</th><th>Khấu trừ</th><th>Thực nhận</th><th>Trạng thái</th><th>Thao tác</th></tr></thead><tbody>
   {loading?<tr><td colSpan="11" className="payroll-empty">Đang tải bảng lương...</td></tr>:filtered.length?filtered.map(row=><tr key={row.employeeId}><td><b>{row.employeeCode}</b></td><td><b>{row.fullName}</b><small>{row.positionName} · {row.branchName}</small></td><td>{row.totalWorkDays}</td><td>{Number(row.totalWorkHours).toFixed(2)}</td><td>{money(row.hourlyRate)}</td><td>{money(row.baseSalary)}</td><td className="payroll-plus">+{money(row.totalAllowance)}</td><td className="payroll-minus">-{money(row.totalDeduction)}</td><td className="payroll-net">{money(row.netSalary)}</td><td><span className={`payroll-status ${row.status}`}>{statusName[row.status]||row.status}</span></td><td><button className="payroll-view" onClick={()=>navigate(`/manager/payrolls/${row.employeeId}?month=${month}`)}><FiEye/> Chi tiết</button></td></tr>):<tr><td colSpan="11" className="payroll-empty">Không có nhân viên phù hợp</td></tr>}
  </tbody></table></div>
 </section>;
}
