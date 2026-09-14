import {useEffect,useMemo,useState} from "react";
import {Link} from "react-router-dom";
import {FiAlertTriangle,FiBox,FiClock,FiDollarSign,FiFileText,FiUsers} from "react-icons/fi";
import {dashboardApi} from "../../api/services";
import {getSession} from "../../utils/auth";
import VietnamDateInput from "../../components/VietnamDateInput";

const money=value=>`${Number(value||0).toLocaleString("vi-VN")}đ`;
const shortMoney=value=>Number(value||0)>=1000000?`${(Number(value)/1000000).toLocaleString("vi-VN",{maximumFractionDigits:1})}tr`:Number(value||0).toLocaleString("vi-VN");
const date=value=>{if(!value)return "—";const raw=String(value).slice(0,10);if(/^\d{4}-\d{2}-\d{2}$/.test(raw))return `${raw.slice(8,10)}/${raw.slice(5,7)}`;const parsed=new Date(value);return Number.isNaN(parsed.getTime())?"—":`${String(parsed.getDate()).padStart(2,"0")}/${String(parsed.getMonth()+1).padStart(2,"0")}`};
const shiftName=value=>value==="morning"?"Ca sáng":"Ca tối";
const statusName=value=>({OPEN:"Đang mở",REOPENED:"Đang mở lại",LOCKED:"Đã kết ca",WAITING_HANDOVER:"Chờ bàn giao"}[value]||"Chưa mở");

export default function DashboardPage(){
 const {user,role}=getSession(),[data,setData]=useState(null),[branchId,setBranchId]=useState(null),[selectedDate,setSelectedDate]=useState(()=>new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Ho_Chi_Minh"}).format(new Date())),[loading,setLoading]=useState(true),[error,setError]=useState("");
 const load=async(selected,dateValue)=>{setLoading(true);setError("");try{const params={date:dateValue};if(selected)params.branchId=selected;const response=await dashboardApi.get(params);setData(response.data)}catch(e){setError(e.response?.data?.message||"Không tải được dữ liệu tổng quan.")}finally{setLoading(false)}};
 useEffect(()=>{load(branchId,selectedDate)},[branchId,selectedDate]);
 useEffect(()=>{if(role==="admin"&&branchId===null&&data?.branches)setBranchId(data.branches[0]?.branchId?String(data.branches[0].branchId):"")},[data,branchId,role]);
 const maxRevenue=useMemo(()=>Math.max(1,...(data?.revenueDays||[]).map(item=>Number(item.totalRevenue||0))),[data]);
 if(loading&&!data)return <div className="dashboard-loading">Đang tải tổng quan...</div>;
 if(error&&!data)return <div className="manager-form-error">{error}</div>;
 const summary=data?.summary||{},tasks=data?.tasks||{},shifts=data?.shifts||[],reports=data?.recentReports||[];
 const shiftCards=["morning","evening"].map(code=>{const items=shifts.filter(item=>item.operationShift===code);return {code,items,open:items.filter(item=>["OPEN","REOPENED"].includes(item.status)).length,closed:items.filter(item=>item.status==="LOCKED").length}});
 const taskRows=[
  ["Ca đang mở cần kết ca",tasks.openShiftCount,"/manager/operations/dashboard",FiClock],
  ["Nhân viên có lịch chưa chấm công",tasks.notCheckedInCount,"/manager/attendance",FiUsers],
  ["Phiếu nhập kho đang nháp",tasks.draftReceiptCount,"/manager/inventory?tab=transactions",FiFileText],
  ["Đơn đặt hàng đang nháp",tasks.draftPurchaseOrderCount,"/manager/inventory?tab=transactions",FiFileText],
  ["Chênh lệch kho chờ xử lý",tasks.pendingDiscrepancyCount,"/manager/shift-inventory",FiAlertTriangle]
 ];
 return <div className="real-dashboard">
  <div className="welcome dashboard-welcome"><div><h2>Xin chào, {user?.name||"Quản lý"}! 👋</h2><p>Tình hình vận hành ngày {date(data?.businessDate)}.</p></div><div className="dashboard-actions"><label className="dashboard-date-filter"><small>Ngày xem tổng quan</small><VietnamDateInput value={selectedDate} onChange={e=>setSelectedDate(e.target.value)}/></label>{role==="admin"&&<label className="dashboard-branch-filter"><small>Phạm vi số liệu</small><select value={branchId??""} onChange={e=>setBranchId(e.target.value)}><option value="">Toàn hệ thống (gộp các chi nhánh)</option>{data?.branches?.map(item=><option key={item.branchId} value={item.branchId}>{item.branchName}</option>)}</select></label>}<Link className="btn btn-primary" to={`/manager/operations/dashboard?date=${selectedDate}${branchId?`&branchId=${branchId}`:""}`}>Xem báo cáo ca</Link></div></div>
  {error&&<div className="manager-form-error">{error}</div>}
  <section className="dashboard-live-stats">
   <Link className="dashboard-live-stat" to={`/manager/operations/dashboard?date=${selectedDate}`} aria-label="Xem doanh thu ngày đã chọn"><i className="revenue"><FiDollarSign/></i><span><small>Doanh thu ngày đã chọn</small><b>{money(summary.totalRevenue)}</b><em>{Number(summary.orderCount||0).toLocaleString("vi-VN")} đơn đã báo cáo</em></span></Link>
   <Link className="dashboard-live-stat" to="/manager/operations/dashboard" aria-label="Xem trạng thái ca"><i className="shift"><FiClock/></i><span><small>Trạng thái ca</small><b>{shiftCards.reduce((sum,item)=>sum+item.open,0)} ca đang mở</b><em>{shiftCards.reduce((sum,item)=>sum+item.closed,0)} ca đã kết</em></span></Link>
   <Link className="dashboard-live-stat" to="/manager/attendance" aria-label="Xem chấm công ngày đã chọn"><i className="people"><FiUsers/></i><span><small>Chấm công ngày đã chọn</small><b>{summary.checkedInEmployees}/{summary.scheduledEmployees}</b><em>nhân viên đã chấm công</em></span></Link>
   <Link className="dashboard-live-stat" to="/manager/inventory" aria-label="Xem cảnh báo tồn kho"><i className="stock"><FiBox/></i><span><small>Cảnh báo tồn kho</small><b>{summary.lowStockCount}</b><em>nguyên liệu sắp hết hoặc đã hết</em></span></Link>
  </section>
  <section className="dashboard-main-grid">
   <article className="card dashboard-revenue-panel"><div className="card-head"><div><h3>Doanh thu 7 ngày</h3><p>Dữ liệu từ báo cáo ca đã gửi</p></div><b>{money((data?.revenueDays||[]).reduce((sum,item)=>sum+item.totalRevenue,0))}</b></div><div className="dashboard-bars">{data?.revenueDays?.map(item=><div key={item.businessDate}><div className="dashboard-bar-track"><span title={money(item.totalRevenue)} style={{height:`${Math.max(item.totalRevenue?8:2,item.totalRevenue/maxRevenue*100)}%`}}/></div><b>{shortMoney(item.totalRevenue)}</b><small>{date(item.businessDate)}</small></div>)}</div></article>
   <article className="card dashboard-task-panel"><div className="card-head"><div><h3>Việc cần xử lý</h3><p>Cập nhật theo dữ liệu vận hành</p></div></div><div className="dashboard-tasks">{taskRows.map(([label,count,to,Icon])=><Link className={count?"attention":"done"} to={to} key={label}><i><Icon/></i><span><b>{label}</b><small>{count?"Bấm để kiểm tra và xử lý":"Không có việc tồn đọng"}</small></span><strong>{count||"✓"}</strong></Link>)}</div></article>
  </section>
  <section className="dashboard-lower-grid">
   <article className="card dashboard-report-list"><div className="card-head"><div><h3>Báo cáo ca gần nhất</h3><p>Doanh thu và chênh lệch tiền thực tế</p></div><Link to="/manager/operations/dashboard">Xem tất cả</Link></div>{reports.length?<div className="table-wrap"><table><thead><tr><th>Ngày</th><th>Chi nhánh</th><th>Ca</th><th>Phụ trách</th><th>Doanh thu</th><th>Chênh lệch</th><th>Trạng thái</th></tr></thead><tbody>{reports.map(item=><tr key={item.shiftSessionId}><td>{date(item.businessDate)}</td><td>{item.branchName}</td><td><b>{shiftName(item.operationShift)}</b></td><td>{item.leaderName||"—"}</td><td><b>{money(item.totalRevenue)}</b></td><td className={Number(item.differenceAmount)<0?"dashboard-negative":Number(item.differenceAmount)>0?"dashboard-positive":""}>{money(item.differenceAmount)}</td><td><span className={`status ${item.reportStatus==="submitted"?"success":"warning"}`}>{item.reportStatus==="submitted"?"Đã gửi":statusName(item.status)}</span></td></tr>)}</tbody></table></div>:<div className="dashboard-empty">Chưa có báo cáo ca.</div>}</article>
   <article className="card dashboard-shift-status"><div className="card-head"><div><h3>Ca ngày đã chọn</h3><p>Trạng thái mở và kết ca</p></div></div>{shiftCards.map(item=><section key={item.code}><header><b>{shiftName(item.code)}</b><span className={item.open?"open":item.closed?"closed":"pending"}>{item.open?"Đang mở":item.closed?"Đã kết ca":"Chưa mở"}</span></header>{item.items.length?item.items.slice(0,3).map((shift,index)=><p key={`${shift.operationShift}-${index}`}><span>{shift.leaderName||"Chưa xác định người mở"}</span><small>{statusName(shift.status)}</small></p>):<p><span>Chưa có ca vận hành</span></p>}</section>)}</article>
  </section>
 </div>;
}
