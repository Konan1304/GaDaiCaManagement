import { useEffect, useMemo, useState } from "react";
import { FiArchive, FiArrowDownCircle, FiArrowUpCircle, FiBox, FiEye, FiSearch, FiX } from "react-icons/fi";
import { useSearchParams } from "react-router-dom";
import { inventoryOverviewApi } from "../../api/services";
import ProductsPage from "./InventoryHistoryPage";
import InventoryTransactionsPage from "./InventoryTransactionsPage";
import ShiftInventoryAdminPage from "../Manager/ShiftInventoryAdminPage";
import "../../styles/inventory-overview.css";

const pad=n=>String(n).padStart(2,"0");
const iso=date=>`${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}`;
const initialDates=()=>{const now=new Date();return{dateFrom:iso(new Date(now.getFullYear(),now.getMonth(),1)),dateTo:iso(now)}};
const qty=value=>new Intl.NumberFormat("vi-VN",{maximumFractionDigits:3}).format(Number(value||0));
const dateTime=value=>value?new Intl.DateTimeFormat("vi-VN",{dateStyle:"short",timeStyle:"short"}).format(new Date(value)):"—";
const typeLabels={import:"Nhập hàng",adjustment_in:"Điều chỉnh tăng",transfer_in:"Nhập chuyển kho",sale:"Xuất bán",waste:"Xuất hủy",adjustment_out:"Điều chỉnh giảm",transfer_out:"Chuyển kho"};
const inbound=new Set(["import","adjustment_in","transfer_in"]);
const statusLabels={in_stock:"Còn hàng",low_stock:"Sắp hết",out_of_stock:"Hết hàng"};

function DetailModal({data,onClose}){
  const s=data.summary;
  return <div className="manager-modal-backdrop" onMouseDown={e=>e.target===e.currentTarget&&onClose()}>
    <div className="employee-modal inventory-detail-modal">
      <header><div><h2>Chi tiết tồn kho</h2><p>{data.branch.branchName} · {data.period.start.split("-").reverse().join("/")} – {data.period.end.split("-").reverse().join("/")}</p></div><button onClick={onClose}><FiX/></button></header>
      <div className="inventory-detail-body">
        <div className="inventory-product-heading"><span><FiBox/></span><div><small>{s.productCode}</small><h3>{s.productName}</h3><p>Đơn vị tính: {s.unitName}</p></div></div>
        <div className="inventory-detail-summary">
          {[['Tồn đầu',s.openingQuantity],['Tổng nhập',s.inbound],['Tổng xuất',s.outbound],['Tồn cuối',s.closingQuantity]].map(([label,value])=><div key={label}><small>{label}</small><strong>{qty(value)} <em>{s.unitName}</em></strong></div>)}
        </div>
        <h3 className="inventory-history-title">Lịch sử biến động</h3>
        <div className="table-wrap"><table><thead><tr><th>Thời gian</th><th>Loại</th><th>Số lượng</th><th>Người thực hiện</th><th>Nội dung / ghi chú</th></tr></thead>
          <tbody>{data.transactions.length?data.transactions.map(x=><tr key={x.id}><td>{dateTime(x.transactionTime)}</td><td><span className={`movement-type ${inbound.has(x.transactionType)?"in":"out"}`}>{typeLabels[x.transactionType]||x.transactionType}</span></td><td className={inbound.has(x.transactionType)?"movement-in":"movement-out"}>{inbound.has(x.transactionType)?"+":"−"}{qty(x.quantity)}</td><td>{x.performedBy}</td><td>{x.reason||"—"}</td></tr>):<tr><td colSpan="5" className="empty-cell">Không có biến động trong khoảng thời gian này.</td></tr>}</tbody>
        </table></div>
      </div>
    </div>
  </div>;
}

export default function InventoryPage(){
  const [searchParams,setSearchParams]=useSearchParams();
  const requestedTab=searchParams.get("tab");
  const activeTab=["products","transactions","inventory-book"].includes(requestedTab)?requestedTab:"stock";
  const [refreshKey,setRefreshKey]=useState(0);
  const dates=useMemo(initialDates,[]);
  const [filters,setFilters]=useState({...dates,branchId:"",search:"",page:1});
  const [draft,setDraft]=useState({...dates,search:""});
  const [data,setData]=useState({branches:[],items:[],summary:{},pagination:{page:1,totalPages:1}});
  const [loading,setLoading]=useState(true),[error,setError]=useState(""),[detail,setDetail]=useState(null),[detailLoading,setDetailLoading]=useState(false);
  useEffect(()=>{let active=true;if(activeTab!=="stock")return()=>{active=false};setLoading(true);setError("");inventoryOverviewApi.list(filters).then(r=>{if(!active)return;setData(r.data);if(!filters.branchId&&r.data.selectedBranchId)setFilters(v=>({...v,branchId:String(r.data.selectedBranchId)}))}).catch(e=>{if(!active)return;setError(e.response?.data?.message||"Không tải được dữ liệu tổng kho");setData(v=>({...v,items:[],summary:{},pagination:{page:1,total:0,totalPages:1}}))}).finally(()=>active&&setLoading(false));return()=>{active=false}},[activeTab,refreshKey,filters.branchId,filters.dateFrom,filters.dateTo,filters.search,filters.page]);
  const submit=e=>{e.preventDefault();setFilters(v=>({...v,...draft,page:1}))};
  const openDetail=async item=>{setDetailLoading(true);setError("");try{const r=await inventoryOverviewApi.detail(item.productId,{branchId:filters.branchId,dateFrom:filters.dateFrom,dateTo:filters.dateTo});setDetail(r.data)}catch(e){setError(e.response?.data?.message||"Không tải được chi tiết sản phẩm")}finally{setDetailLoading(false)}};
  const changeTab=tab=>{const next=new URLSearchParams(searchParams);tab==="stock"?next.delete("tab"):next.set("tab",tab);setSearchParams(next,{replace:true})};
  const cards=[['Tổng mặt hàng',data.summary.totalProducts,FiBox],['Tổng tồn đầu',qty(data.summary.totalOpening),FiArchive],['Tổng nhập',qty(data.summary.totalInbound),FiArrowDownCircle],['Tổng xuất',qty(data.summary.totalOutbound),FiArrowUpCircle],['Tổng tồn cuối',qty(data.summary.totalClosing),FiBox]];
  return <section className="inventory-overview-page">
    <div className="inventory-page-title"><div><h2>Tổng kho hàng</h2><p>Theo dõi tồn đầu, nhập – xuất và tồn cuối của toàn bộ hàng hóa trong kho.</p></div></div>
    <nav className="inventory-module-tabs" aria-label="Quản lý tổng kho">
      <button type="button" className={activeTab==="stock"?"active":""} onClick={()=>changeTab("stock")}>Tồn kho tổng hợp</button>
      <button type="button" className={activeTab==="products"?"active":""} onClick={()=>changeTab("products")}>Quản lý sản phẩm</button>
      <button type="button" className={activeTab==="transactions"?"active":""} onClick={()=>changeTab("transactions")}>Nhập - Xuất</button>
      <button type="button" className={activeTab==="inventory-book"?"active":""} onClick={()=>changeTab("inventory-book")}>Sổ kiểm kho</button>
    </nav>
    {activeTab==="products"?<ProductsPage embedded/>:activeTab==="transactions"?<InventoryTransactionsPage key={refreshKey} branches={data.branches} defaultBranchId={filters.branchId||data.selectedBranchId} period={data.period||dates} onChanged={()=>setRefreshKey(value=>value+1)}/>:activeTab==="inventory-book"?<ShiftInventoryAdminPage embedded/>:<>
    <form className="card inventory-filters" onSubmit={submit}>
      <label>Chi nhánh<select value={filters.branchId} onChange={e=>setFilters(v=>({...v,branchId:e.target.value,page:1}))}>{data.branches.map(x=><option key={x.id} value={x.id}>{x.branchName}</option>)}</select></label>
      <label>Từ ngày<input type="date" value={draft.dateFrom} max={draft.dateTo} onChange={e=>setDraft(v=>({...v,dateFrom:e.target.value}))}/></label>
      <label>Đến ngày<input type="date" value={draft.dateTo} min={draft.dateFrom} onChange={e=>setDraft(v=>({...v,dateTo:e.target.value}))}/></label>
      <label className="inventory-search">Tìm sản phẩm<div><FiSearch/><input value={draft.search} onChange={e=>setDraft(v=>({...v,search:e.target.value}))} placeholder="Tên hoặc mã sản phẩm"/></div></label>
      <button className="btn btn-primary">Lọc dữ liệu</button>
    </form>
    {error&&<div className="manager-form-error">{error}</div>}
    <div className="inventory-summary-cards">{cards.map(([label,value,Icon])=><article className="card" key={label}><span><Icon/></span><div><small>{label}</small><strong>{loading?"…":value??0}</strong></div></article>)}</div>
    <div className="card inventory-table-card"><div className="inventory-table-head"><div><h3>Bảng tổng kho</h3><p>{data.pagination.total||0} mặt hàng trong khoảng thời gian đã chọn</p></div></div>
      <div className="table-wrap"><table><thead><tr>{['Sản phẩm','Đơn vị tính','Tồn đầu','Nhập','Xuất','Tồn cuối','Trạng thái','Thao tác'].map(x=><th key={x}>{x}</th>)}</tr></thead>
        <tbody>{!loading&&data.items.length?data.items.map(x=><tr key={x.productId}><td><b>{x.productName}</b><small>{x.productCode}</small></td><td>{x.unitName}</td><td>{qty(x.openingQuantity)}</td><td className="movement-in">+{qty(x.inbound)}</td><td className="movement-out">−{qty(x.outbound)}</td><td><strong>{qty(x.closingQuantity)}</strong></td><td><span className={`stock-state ${x.stockStatus}`}>{statusLabels[x.stockStatus]}</span></td><td><button className="inventory-detail-button" disabled={detailLoading} onClick={()=>openDetail(x)}><FiEye/> Xem chi tiết</button></td></tr>):<tr><td colSpan="8" className="empty-cell">{loading?"Đang tải dữ liệu...":"Không có sản phẩm trong kho chi nhánh."}</td></tr>}</tbody>
      </table></div>
      <div className="inventory-pagination"><span>Trang {data.pagination.page||1}/{data.pagination.totalPages||1}</span><div><button disabled={(data.pagination.page||1)<=1} onClick={()=>setFilters(v=>({...v,page:v.page-1}))}>‹</button><button disabled={(data.pagination.page||1)>=(data.pagination.totalPages||1)} onClick={()=>setFilters(v=>({...v,page:v.page+1}))}>›</button></div></div>
    </div>
    {detail&&<DetailModal data={detail} onClose={()=>setDetail(null)}/>}
    </>}
  </section>;
}
