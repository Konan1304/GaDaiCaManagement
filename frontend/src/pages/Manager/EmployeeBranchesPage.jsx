import {useEffect,useMemo,useState} from "react";
import {FiArrowRight,FiGitBranch,FiMapPin,FiPhone,FiPlus,FiSearch,FiUsers,FiX} from "react-icons/fi";
import {Link,useNavigate} from "react-router-dom";
import {managerEmployeeApi} from "../../api/services";

export default function EmployeeBranchesPage(){
 const navigate=useNavigate(),[items,setItems]=useState([]),[search,setSearch]=useState(""),[status,setStatus]=useState("");
 const [loading,setLoading]=useState(true),[error,setError]=useState(""),[showCreate,setShowCreate]=useState(false),[branchForm,setBranchForm]=useState({branchCode:"",branchName:"",phone:"",address:""});
 const load=()=>{setLoading(true);setError("");return managerEmployeeApi.employeeBranches({search,status}).then(response=>setItems(response.data||[])).catch(e=>setError(e.response?.data?.message||"Không tải được danh sách chi nhánh")).finally(()=>setLoading(false))};
 useEffect(()=>{const timer=setTimeout(load,search?250:0);return()=>clearTimeout(timer)},[search,status]);
 async function createBranch(event){event.preventDefault();setError("");try{await managerEmployeeApi.createBranch(branchForm);setShowCreate(false);setBranchForm({branchCode:"",branchName:"",phone:"",address:""});load()}catch(e){setError(e.response?.data?.message||"Không thể thêm chi nhánh")}}
 const totals=useMemo(()=>items.reduce((sum,item)=>sum+Number(item.totalEmployees||0),0),[items]);
 return <section className="manager-branch-page">
  <div className="employee-page-title"><div><h1>Quản lý nhân viên</h1><p>Chọn chi nhánh để xem và quản lý nhân viên.</p></div><div className="branch-directory-actions"><div className="branch-total"><FiUsers/><b>{totals}</b><span>nhân viên</span></div><button className="btn btn-primary" onClick={()=>setShowCreate(true)}><FiPlus/> Thêm chi nhánh</button></div></div>
  <div className="branch-directory-tools"><label><FiSearch/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Tìm tên, mã hoặc địa chỉ chi nhánh"/></label><select value={status} onChange={e=>setStatus(e.target.value)}><option value="">Tất cả trạng thái</option><option value="active">Đang hoạt động</option><option value="inactive">Ngừng hoạt động</option></select></div>
  {error&&<div className="manager-form-error">{error}</div>}
  {loading?<div className="branch-card-grid">{[1,2].map(item=><i className="branch-card-skeleton" key={item}/>)}</div>:items.length?<div className="branch-card-grid">{items.map(branch=><article className="branch-card" key={branch.branchId} onClick={()=>navigate(`/manager/employees/branch/${branch.branchId}`)}>
   <header><span><FiGitBranch/></span><div><h2>{branch.branchName}</h2><small>{branch.branchCode}</small></div><b className={`branch-status ${branch.status}`}>{branch.status==="active"?"Đang hoạt động":"Ngừng hoạt động"}</b></header>
   <div className="branch-contact"><p><FiMapPin/>{branch.address||"Chưa cập nhật địa chỉ"}</p><p><FiPhone/>{branch.phone||"Chưa cập nhật số điện thoại"}</p></div>
   <div className="branch-stats"><span><b>{branch.totalEmployees}</b><small>Nhân viên</small></span><span><b>{branch.workingEmployees}</b><small>Đang làm</small></span><span><b>{branch.resignedEmployees}</b><small>Đã nghỉ</small></span><span><b>{branch.lockedAccounts}</b><small>TK khóa/ngừng</small></span></div>
   <footer><Link onClick={e=>e.stopPropagation()} to={`/manager/employees/branch/${branch.branchId}`}><span>Xem nhân viên</span><FiArrowRight/></Link><Link className="add" onClick={e=>e.stopPropagation()} to={`/manager/employees/branch/${branch.branchId}?create=1`}><FiPlus/> Thêm nhân viên</Link></footer>
  </article>)}</div>:<div className="card employee-table-empty">Chưa có chi nhánh trong hệ thống</div>}
  {showCreate&&<div className="manager-modal-backdrop"><form className="employee-modal branch-modal" onSubmit={createBranch}><header><div><h2>Thêm chi nhánh</h2><p>Dữ liệu được lưu trực tiếp vào SQL Server.</p></div><button type="button" onClick={()=>setShowCreate(false)}><FiX/></button></header><fieldset><section><div className="employee-form-grid"><label>Mã chi nhánh *<input required value={branchForm.branchCode} onChange={e=>setBranchForm({...branchForm,branchCode:e.target.value})}/></label><label>Tên chi nhánh *<input required value={branchForm.branchName} onChange={e=>setBranchForm({...branchForm,branchName:e.target.value})}/></label><label>Số điện thoại<input value={branchForm.phone} onChange={e=>setBranchForm({...branchForm,phone:e.target.value})}/></label><label>Địa chỉ<input value={branchForm.address} onChange={e=>setBranchForm({...branchForm,address:e.target.value})}/></label></div></section></fieldset><footer><button type="button" className="btn btn-light" onClick={()=>setShowCreate(false)}>Hủy</button><button className="btn btn-primary">Thêm chi nhánh</button></footer></form></div>}
 </section>
}
