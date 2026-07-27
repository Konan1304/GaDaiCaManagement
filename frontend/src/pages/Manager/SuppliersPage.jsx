import {useCallback,useEffect,useState} from "react";
import {FiEdit2,FiEye,FiLock,FiPlus,FiSearch,FiTrash2,FiTruck,FiUnlock,FiX} from "react-icons/fi";
import {supplierApi} from "../../api/services";
const empty={supplierCode:"",supplierName:"",displayName:"",supplierGroup:"",suppliedItems:"",contactPerson:"",phone:"",email:"",address:"",taxCode:"",notes:"",status:"active"};
const date=value=>value?new Date(value).toLocaleDateString("vi-VN"):"—";
const money=value=>Number(value||0).toLocaleString("vi-VN")+"đ";

function SupplierModal({mode,item,onClose,onSaved}){
 const [form,setForm]=useState(item?{...empty,...item}:empty),[detail,setDetail]=useState(item),[saving,setSaving]=useState(false),[error,setError]=useState("");
 useEffect(()=>{if(mode==="view")supplierApi.detail(item.supplierId).then(r=>setDetail(r.data)).catch(e=>setError(e.response?.data?.message||"Không tải được chi tiết."))},[mode,item]);
 const submit=async e=>{e.preventDefault();setSaving(true);setError("");try{const r=item?await supplierApi.update(item.supplierId,form):await supplierApi.create(form);onSaved(r.message)}catch(x){setError(x.response?.data?.message||"Không thể lưu nhà cung cấp.");setSaving(false)}};
 return <div className="manager-modal-backdrop" onMouseDown={e=>e.target===e.currentTarget&&onClose()}><div className="employee-modal supplier-modal">
  <header><div className="category-modal-heading"><span><FiTruck/></span><div><h2>{mode==="view"?"Chi tiết nhà cung cấp":item?"Sửa nhà cung cấp":"Thêm nhà cung cấp"}</h2><p>Dữ liệu nhà cung cấp được lưu tại SQL Server.</p></div></div><button onClick={onClose}><FiX/></button></header>
  {error&&<div className="manager-form-error">{error}</div>}
  {mode==="view"?detail&&<div className="supplier-detail">
   <section className="supplier-detail-hero"><div><small>{detail.supplierCode}</small><h3>{detail.displayName||detail.supplierName}</h3><p>{detail.supplierName}</p></div><span className={`category-detail-status ${detail.status}`}>{detail.status==="active"?"Hoạt động":"Ngừng sử dụng"}</span></section>
   <section className="supplier-summary"><div><small>Nhóm cung cấp</small><b>{detail.supplierGroup||"Chưa cập nhật"}</b></div><div><small>Tổng phiếu nhập</small><b>{detail.receiptCount||0} phiếu</b></div><div><small>Lần nhập gần nhất</small><b>{date(detail.lastReceiptAt)}</b></div><div><small>Tổng giá trị nhập</small><b>{money(detail.totalImportValue)}</b></div></section>
   <section className="supplier-info"><div><small>Địa chỉ</small><b>{detail.address||"Chưa cập nhật"}</b></div><div><small>Mã số thuế</small><b>{detail.taxCode||"Chưa cập nhật"}</b></div><div><small>Người liên hệ</small><b>{detail.contactPerson||"Chưa cập nhật"}</b></div><div><small>Điện thoại / Email</small><b>{detail.phone||"—"} · {detail.email||"—"}</b></div></section>
   <section className="supplier-items"><h3>Nhóm sản phẩm đang cung cấp</h3>{detail.suppliedItems?<ul>{detail.suppliedItems.split("\n").filter(Boolean).map(x=><li key={x}>{x}</li>)}</ul>:<p>Chưa cập nhật sản phẩm cung cấp.</p>}</section>
   <section className="supplier-receipts"><h3>Lịch sử nhập hàng</h3>{detail.receipts?.length?<div>{detail.receipts.map(x=><article key={x.receiptCode}><b>{x.receiptCode}</b><span>{date(x.receiptDate)}</span><strong>{money(x.totalAmount)}</strong></article>)}</div>:<p>Chưa phát sinh giao dịch nhập hàng.</p>}</section>
   {detail.notes&&<section className="supplier-note"><small>Ghi chú</small><p>{detail.notes}</p></section>}
  </div>:<form className="supplier-form" onSubmit={submit}>
   <label>Mã nhà cung cấp<input placeholder="Để trống để tự sinh NCC..." value={form.supplierCode} onChange={e=>setForm({...form,supplierCode:e.target.value})}/></label>
   <label>Tên đầy đủ *<input required value={form.supplierName} onChange={e=>setForm({...form,supplierName:e.target.value})}/></label>
   <label>Tên hiển thị<input value={form.displayName} onChange={e=>setForm({...form,displayName:e.target.value})}/></label>
   <label>Nhóm hàng cung cấp<input value={form.supplierGroup} onChange={e=>setForm({...form,supplierGroup:e.target.value})}/></label>
   <label className="wide">Các mặt hàng cung cấp<textarea placeholder="Mỗi mặt hàng một dòng" value={form.suppliedItems} onChange={e=>setForm({...form,suppliedItems:e.target.value})}/></label>
   <label>Người liên hệ<input value={form.contactPerson} onChange={e=>setForm({...form,contactPerson:e.target.value})}/></label>
   <label>Số điện thoại<input value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})}/></label>
   <label>Email<input type="email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})}/></label>
   <label>Mã số thuế<input value={form.taxCode} onChange={e=>setForm({...form,taxCode:e.target.value})}/></label>
   <label className="wide">Địa chỉ<textarea value={form.address} onChange={e=>setForm({...form,address:e.target.value})}/></label>
   <label className="wide">Ghi chú<textarea value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})}/></label>
   <label>Trạng thái<select value={form.status} onChange={e=>setForm({...form,status:e.target.value})}><option value="active">Hoạt động</option><option value="inactive">Ngừng sử dụng</option></select></label>
   <footer className="wide"><button type="button" className="btn btn-light" onClick={onClose}>Hủy</button><button className="btn btn-primary" disabled={saving}>{saving?"Đang lưu...":"Lưu nhà cung cấp"}</button></footer>
  </form>}
 </div></div>;
}

export default function SuppliersPage(){
 const [query,setQuery]=useState(""),[search,setSearch]=useState(""),[status,setStatus]=useState(""),[group,setGroup]=useState(""),[page,setPage]=useState(1);
 const [data,setData]=useState({items:[],groups:[],pagination:{total:0,totalPages:1}}),[loading,setLoading]=useState(true),[modal,setModal]=useState(null),[message,setMessage]=useState(""),[error,setError]=useState("");
 const load=useCallback(()=>{setLoading(true);supplierApi.list({search,status,group,page,limit:8}).then(r=>setData(r.data)).catch(e=>setError(e.response?.data?.message||"Không tải được nhà cung cấp.")).finally(()=>setLoading(false))},[search,status,group,page]);
 useEffect(load,[load]);const saved=msg=>{setModal(null);setMessage(msg);load()};
 const toggle=async x=>{try{const r=await supplierApi.update(x.supplierId,{...x,status:x.status==="active"?"inactive":"active"});setMessage(r.message);load()}catch(e){setError(e.response?.data?.message||"Không thể đổi trạng thái.")}};
 const remove=async x=>{if(!window.confirm(`Xóa nhà cung cấp “${x.displayName||x.supplierName}”?`))return;try{const r=await supplierApi.remove(x.supplierId);setMessage(r.message);load()}catch(e){setError(e.response?.data?.message||"Không thể xóa nhà cung cấp.")}};
 return <div><div className="section-title"><div><h1>Nhà cung cấp</h1><p>Quản lý đối tác cung ứng và lịch sử nhập hàng.</p></div><button className="btn btn-primary" onClick={()=>setModal({mode:"create"})}><FiPlus/> Thêm nhà cung cấp</button></div>
 {message&&<div className="manager-form-success">{message}</div>}{error&&<div className="manager-form-error">{error}</div>}
 <section className="card list-card"><div className="supplier-toolbar"><form onSubmit={e=>{e.preventDefault();setPage(1);setSearch(query.trim())}}><FiSearch/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Tìm tên, mã hoặc mã số thuế..."/><button className="btn btn-primary">Tìm kiếm</button></form><select value={status} onChange={e=>{setStatus(e.target.value);setPage(1)}}><option value="">Tất cả trạng thái</option><option value="active">Hoạt động</option><option value="inactive">Ngừng sử dụng</option></select><select value={group} onChange={e=>{setGroup(e.target.value);setPage(1)}}><option value="">Tất cả nhóm hàng</option>{data.groups.map(x=><option key={x.supplierGroup}>{x.supplierGroup}</option>)}</select><b>{data.pagination.total} NCC</b></div>
 <div className="table-wrap"><table className="supplier-table"><thead><tr>{["Mã NCC","Tên nhà cung cấp","Tên hiển thị","Nhóm hàng cung cấp","Số điện thoại","Địa chỉ","Mã số thuế","Trạng thái","Thao tác"].map(x=><th key={x}>{x}</th>)}</tr></thead><tbody>{loading?<tr><td colSpan="9" className="category-empty">Đang tải...</td></tr>:data.items.map(x=><tr key={x.supplierId}><td><b>{x.supplierCode}</b></td><td><button className="category-name-link" onClick={()=>setModal({mode:"view",item:x})}><b>{x.supplierName}</b></button></td><td>{x.displayName||"—"}</td><td>{x.supplierGroup||"—"}</td><td>{x.phone||"—"}</td><td className="supplier-address">{x.address||"—"}</td><td>{x.taxCode||"—"}</td><td><span className={`status ${x.status==="active"?"success":"neutral"}`}>{x.status==="active"?"Hoạt động":"Ngừng sử dụng"}</span></td><td><div className="category-actions"><button onClick={()=>setModal({mode:"view",item:x})}><FiEye/></button><button onClick={()=>setModal({mode:"edit",item:x})}><FiEdit2/></button><button onClick={()=>toggle(x)}>{x.status==="active"?<FiLock/>:<FiUnlock/>}</button><button className="danger" onClick={()=>remove(x)}><FiTrash2/></button></div></td></tr>)}</tbody></table></div>
 <div className="category-pagination"><span>Hiển thị {data.items.length} trong {data.pagination.total} nhà cung cấp</span><div><button disabled={page<=1} onClick={()=>setPage(page-1)}>‹</button><b>{page}/{data.pagination.totalPages}</b><button disabled={page>=data.pagination.totalPages} onClick={()=>setPage(page+1)}>›</button></div></div></section>
 {modal&&<SupplierModal mode={modal.mode} item={modal.item} onClose={()=>setModal(null)} onSaved={saved}/>}</div>;
}
