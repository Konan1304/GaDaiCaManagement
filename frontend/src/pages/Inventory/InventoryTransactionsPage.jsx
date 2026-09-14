import {useEffect,useMemo,useState} from "react";
import {FiArrowDownCircle,FiArrowUpCircle,FiEye,FiX} from "react-icons/fi";
import {importApi,inventoryOverviewApi,productApi} from "../../api/services";
import VietnamDateInput from "../../components/VietnamDateInput";
import ImportInventoryPage from "./ImportInventoryPage";

const incoming=new Set(["import","adjustment_in","transfer_in"]);
const quantity=v=>new Intl.NumberFormat("vi-VN",{maximumFractionDigits:3}).format(Number(v||0));
const when=v=>v?new Intl.DateTimeFormat("vi-VN",{dateStyle:"short",timeStyle:"short"}).format(new Date(v)):"—";
const sourceOf=x=>{
  if(String(x.transactionType).startsWith("adjustment_"))return "Điều chỉnh kho";
  if(["shift_inventory","shift_inventory_session","shift_inventory_adjustment","shift_inventory_receive","shift_inventory_usage"].includes(x.referenceType))return incoming.has(x.transactionType)?"Nhập trong ca":"Xuất trong ca";
  if(x.referenceType==="purchase_receipt")return "Nhập kho";
  if(x.referenceType==="stock_export")return "Xuất kho";
  return incoming.has(x.transactionType)?"Nhập kho":"Xuất kho";
};

export default function InventoryTransactionsPage({branches=[],defaultBranchId="",period,onChanged}){
  const defaults=useMemo(()=>({branchId:String(defaultBranchId||branches[0]?.id||""),dateFrom:period?.start||"",dateTo:period?.end||"",search:"",direction:"all",page:1,limit:30}),[defaultBranchId,branches,period]);
  const [filters,setFilters]=useState(defaults),[rows,setRows]=useState([]),[page,setPage]=useState({page:1,total:0,totalPages:1});
  const [products,setProducts]=useState([]),[pendingReceipts,setPendingReceipts]=useState(0),[mode,setMode]=useState(""),[selected,setSelected]=useState(null),[error,setError]=useState(""),[message,setMessage]=useState(""),[busy,setBusy]=useState(false);
  const [form,setForm]=useState({branchId:String(defaultBranchId||branches[0]?.id||""),productId:"",quantity:"",reason:""});
  useEffect(()=>setFilters(defaults),[defaults]);
  const load=async(next=filters)=>{if(!next.branchId)return;try{setBusy(true);setError("");const r=await inventoryOverviewApi.transactions(next);setRows(r.data.items||[]);setPage(r.data.pagination||{page:1,total:0,totalPages:1})}catch(e){setError(e.response?.data?.message||"Không tải được lịch sử nhập - xuất")}finally{setBusy(false)}};
  useEffect(()=>{load(filters)},[filters.branchId,filters.dateFrom,filters.dateTo,filters.direction,filters.page]);
  useEffect(()=>{productApi.list({status:"active"}).then(r=>setProducts(Array.isArray(r.data)?r.data:(r.data?.items||[]))).catch(()=>setProducts([]))},[]);
  const loadPending=()=>importApi.list({status:"submitted",page:1,limit:1}).then(r=>setPendingReceipts(Number(r.data?.pagination?.total||0))).catch(()=>setPendingReceipts(0));
  useEffect(()=>{loadPending()},[]);
  const submitExport=async e=>{e.preventDefault();try{setBusy(true);setError("");const r=await inventoryOverviewApi.createExport({...form,branchId:Number(form.branchId),productId:Number(form.productId),quantity:Number(form.quantity)});setMessage(r.message);setMode("");setForm(v=>({...v,productId:"",quantity:"",reason:""}));await load({...filters,branchId:form.branchId,page:1});onChanged?.()}catch(err){setError(err.response?.data?.message||"Không thể xuất kho")}finally{setBusy(false)}};
  return <div className="inventory-transactions-tab">
    <div className="inventory-transaction-actions">
      <button className="btn btn-primary" onClick={()=>setMode("import")}><FiArrowDownCircle/> Nhập hàng</button>
      <button className="btn btn-dark" onClick={()=>{setForm(v=>({...v,branchId:filters.branchId}));setMode("export")}}><FiArrowUpCircle/> Xuất hàng</button>
      <button className={`btn pending-receipt-button ${pendingReceipts?"has-pending":""}`} onClick={()=>setMode("import")}><FiEye/> Phiếu nhân viên chờ duyệt <b>{pendingReceipts}</b></button>
    </div>
    {message&&<div className="manager-form-success">{message}</div>}{error&&<div className="manager-form-error">{error}</div>}
    <form className="card transaction-filters" onSubmit={e=>{e.preventDefault();const next={...filters,page:1};setFilters(next);load(next)}}>
      <label>Chi nhánh<select value={filters.branchId} onChange={e=>setFilters(v=>({...v,branchId:e.target.value,page:1}))}>{branches.map(b=><option key={b.id} value={b.id}>{b.branchName}</option>)}</select></label>
      <label>Từ ngày<VietnamDateInput value={filters.dateFrom} onChange={e=>setFilters(v=>({...v,dateFrom:e.target.value,page:1}))}/></label>
      <label>Đến ngày<VietnamDateInput value={filters.dateTo} onChange={e=>setFilters(v=>({...v,dateTo:e.target.value,page:1}))}/></label>
      <label>Tìm sản phẩm<input value={filters.search} placeholder="Mã hoặc tên sản phẩm" onChange={e=>setFilters(v=>({...v,search:e.target.value}))}/></label>
      <button className="btn btn-primary">Lọc</button>
    </form>
    <div className="card inventory-table-card"><div className="inventory-table-head transaction-history-head"><div><h3>Lịch sử nhập - xuất</h3><p>{page.total||0} giao dịch trong khoảng thời gian đã chọn</p></div><div className="transaction-direction-tabs">{[["all","Tất cả"],["in","Nhập"],["out","Xuất"]].map(([value,label])=><button type="button" key={value} className={filters.direction===value?"active":""} onClick={()=>setFilters(current=>({...current,direction:value,page:1}))}>{label}</button>)}</div></div>
      <div className="table-wrap"><table><thead><tr>{["Thời gian","Mã sản phẩm","Tên sản phẩm","Loại giao dịch","Số lượng","Đơn vị tính","Chi nhánh","Người thực hiện","Nguồn giao dịch","Ghi chú","Thao tác"].map(x=><th key={x}>{x}</th>)}</tr></thead>
        <tbody>{rows.length?rows.map(x=>{const isIn=incoming.has(x.transactionType);return <tr key={x.id}><td>{when(x.transactionTime)}</td><td>{x.productCode}</td><td><b>{x.productName}</b></td><td><span className={`movement-type ${isIn?"in":"out"}`}>{isIn?"Nhập":"Xuất"}</span></td><td className={isIn?"movement-in":"movement-out"}>{isIn?"+":"−"}{quantity(x.quantity)}</td><td>{x.unitName}</td><td>{x.branchName}</td><td>{x.performedBy}</td><td>{sourceOf(x)}</td><td>{x.reason||"—"}</td><td><button className="inventory-detail-button" title="Chi tiết giao dịch" onClick={()=>setSelected(x)}><FiEye/></button></td></tr>}):<tr><td colSpan="11" className="empty-cell">{busy?"Đang tải...":"Chưa có giao dịch nhập - xuất."}</td></tr>}</tbody>
      </table></div>
      <div className="inventory-pagination"><span>Trang {page.page||1}/{page.totalPages||1}</span><div><button disabled={page.page<=1} onClick={()=>setFilters(v=>({...v,page:v.page-1}))}>‹</button><button disabled={page.page>=page.totalPages} onClick={()=>setFilters(v=>({...v,page:v.page+1}))}>›</button></div></div>
    </div>
    {mode==="import"&&<div className="manager-modal-backdrop inventory-import-overlay"><div className="inventory-import-shell"><button className="inventory-overlay-close" onClick={()=>{setMode("");load();loadPending();onChanged?.()}}><FiX/></button><ImportInventoryPage/></div></div>}
    {selected&&<div className="manager-modal-backdrop" onMouseDown={e=>e.target===e.currentTarget&&setSelected(null)}><div className="employee-modal category-modal transaction-detail-modal"><header><div><h2>Chi tiết giao dịch</h2><p>Mã giao dịch #{selected.id}</p></div><button onClick={()=>setSelected(null)}><FiX/></button></header><div className="transaction-detail-grid">
      <div><small>Thời gian</small><strong>{when(selected.transactionTime)}</strong></div><div><small>Loại giao dịch</small><strong>{sourceOf(selected)}</strong></div>
      <div><small>Sản phẩm</small><strong>{selected.productCode} - {selected.productName}</strong></div><div><small>Số lượng</small><strong className={incoming.has(selected.transactionType)?"movement-in":"movement-out"}>{incoming.has(selected.transactionType)?"+":"−"}{quantity(selected.quantity)} {selected.unitName}</strong></div>
      <div><small>Chi nhánh</small><strong>{selected.branchName}</strong></div><div><small>Người thực hiện</small><strong>{selected.performedBy}</strong></div>
      <div className="transaction-detail-note"><small>Ghi chú</small><strong>{selected.reason||"—"}</strong></div>
    </div></div></div>}
    {mode==="export"&&<div className="manager-modal-backdrop"><div className="employee-modal category-modal inventory-export-modal"><header><div><h2>Xuất hàng</h2><p>Ghi nhận xuất kho và tự động trừ tồn tại chi nhánh.</p></div><button onClick={()=>setMode("")}><FiX/></button></header><form className="category-form inventory-export-form" onSubmit={submitExport}>
      <label>Chi nhánh *<select required value={form.branchId} onChange={e=>setForm({...form,branchId:e.target.value})}>{branches.map(b=><option key={b.id} value={b.id}>{b.branchName}</option>)}</select></label>
      <label>Sản phẩm *<select required value={form.productId} onChange={e=>setForm({...form,productId:e.target.value})}><option value="">Chọn sản phẩm</option>{products.map(p=><option key={p.id} value={p.id}>{p.productCode} - {p.productName} ({p.unitName})</option>)}</select></label>
      <label>Số lượng *<input required min="0.001" step="0.001" type="number" value={form.quantity} onChange={e=>setForm({...form,quantity:e.target.value})}/></label>
      <label>Ghi chú<textarea placeholder="Nhập mục đích xuất hàng (nếu có)" value={form.reason} onChange={e=>setForm({...form,reason:e.target.value})}/></label>
      <footer><button type="button" className="btn btn-light" onClick={()=>setMode("")}>Hủy</button><button disabled={busy} className="btn btn-primary">Xác nhận xuất kho</button></footer>
    </form></div></div>}
  </div>;
}
