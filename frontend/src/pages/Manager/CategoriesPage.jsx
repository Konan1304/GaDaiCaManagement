import {useCallback,useEffect,useState} from "react";
import {FiBox,FiEdit2,FiEye,FiLock,FiPackage,FiPlus,FiSearch,FiTag,FiTrash2,FiUnlock,FiX} from "react-icons/fi";
import {categoryApi} from "../../api/services";

const emptyForm={categoryName:"",description:"",status:"active"};
const formatDate=value=>value?new Date(value).toLocaleDateString("vi-VN"):"—";

function CategoryModal({mode,item,onClose,onSaved}){
 const [form,setForm]=useState(item?{categoryName:item.categoryName,description:item.description||"",status:item.status}:emptyForm);
 const [detail,setDetail]=useState(item),[saving,setSaving]=useState(false),[error,setError]=useState("");
 useEffect(()=>{if(mode==="view"&&item)categoryApi.detail(item.categoryId).then(r=>setDetail(r.data)).catch(e=>setError(e.response?.data?.message||"Không tải được danh mục."))},[mode,item]);
 const submit=async event=>{event.preventDefault();setSaving(true);setError("");try{
   const response=item?await categoryApi.update(item.categoryId,form):await categoryApi.create(form);onSaved(response.message);
  }catch(e){setError(e.response?.data?.message||"Không thể lưu danh mục.");setSaving(false)}};
 return <div className="manager-modal-backdrop" onMouseDown={event=>event.target===event.currentTarget&&onClose()}><div className={`employee-modal category-modal ${mode==="view"?"category-view-modal":"category-editor-modal"}`}>
  <header><div className="category-modal-heading">{mode==="view"&&<span><FiTag/></span>}<div><h2>{mode==="view"?"Chi tiết danh mục":item?"Sửa danh mục":"Thêm danh mục"}</h2><p>{mode==="view"?"Thông tin và các sản phẩm đang thuộc danh mục.":"Thông tin được lưu trực tiếp vào SQL Server."}</p></div></div><button onClick={onClose}><FiX/></button></header>
  {error&&<div className="manager-form-error">{error}</div>}
  {mode==="view"?detail&&<div className="category-detail">
   <section className="category-detail-hero"><div><small>Mã danh mục · {detail.categoryCode}</small><h3>{detail.categoryName}</h3><p>{detail.description||"Danh mục chưa có mô tả."}</p></div><span className={`category-detail-status ${detail.status}`}>{detail.status==="active"?"Hoạt động":"Ngừng sử dụng"}</span></section>
   <section className="category-detail-stats"><div><FiPackage/><span><small>Số lượng sản phẩm</small><b>{detail.productCount||0} sản phẩm</b></span></div><div><FiBox/><span><small>Ngày tạo</small><b>{formatDate(detail.createdAt)}</b></span></div></section>
   <section className="category-product-section"><div className="category-product-head"><div><h3>Sản phẩm thuộc danh mục</h3><p>Danh sách được liên kết trực tiếp từ dữ liệu sản phẩm.</p></div><b>{detail.products?.length||0}</b></div>
    {detail.products?.length?<div className="category-product-grid">{detail.products.map((x,index)=><article key={x.productId}><span>{index+1}</span><div><b>{x.productName}</b><small>{x.productCode}</small></div><em className={x.status}>{x.status==="active"?"Đang sử dụng":"Ngừng sử dụng"}</em></article>)}</div>:<div className="category-product-empty"><FiPackage/><b>Chưa có sản phẩm</b><span>Danh mục này hiện chưa được gán cho sản phẩm nào.</span></div>}
   </section>
  </div>:<form className="category-form" onSubmit={submit}>
   <label>Tên danh mục *<input required maxLength="150" value={form.categoryName} onChange={e=>setForm({...form,categoryName:e.target.value})}/></label>
   <label>Mô tả<textarea maxLength="500" value={form.description} onChange={e=>setForm({...form,description:e.target.value})}/></label>
   <label>Trạng thái<select value={form.status} onChange={e=>setForm({...form,status:e.target.value})}><option value="active">Hoạt động</option><option value="inactive">Ngừng sử dụng</option></select></label>
   <footer><button type="button" className="btn btn-light" onClick={onClose}>Hủy</button><button disabled={saving} className="btn btn-primary">{saving?"Đang lưu...":"Lưu danh mục"}</button></footer>
  </form>}
 </div></div>;
}

export default function CategoriesPage(){
 const [query,setQuery]=useState(""),[search,setSearch]=useState(""),[status,setStatus]=useState(""),[page,setPage]=useState(1);
 const [data,setData]=useState({items:[],pagination:{page:1,total:0,totalPages:1}}),[loading,setLoading]=useState(true);
 const [modal,setModal]=useState(null),[message,setMessage]=useState(""),[error,setError]=useState("");
 const load=useCallback(()=>{setLoading(true);setError("");categoryApi.list({search,status,page,limit:8}).then(r=>setData(r.data)).catch(e=>setError(e.response?.data?.message||"Không tải được danh mục.")).finally(()=>setLoading(false))},[search,status,page]);
 useEffect(load,[load]);
 const apply=e=>{e.preventDefault();setPage(1);setSearch(query.trim())};
 const saved=msg=>{setModal(null);setMessage(msg);load()};
 const toggle=async item=>{try{const response=await categoryApi.update(item.categoryId,{categoryName:item.categoryName,description:item.description||"",status:item.status==="active"?"inactive":"active"});setMessage(response.message);load()}catch(e){setError(e.response?.data?.message||"Không thể đổi trạng thái.")}};
 const remove=async item=>{if(!window.confirm(`Xóa danh mục “${item.categoryName}”?`))return;try{const response=await categoryApi.remove(item.categoryId);setMessage(response.message);load()}catch(e){setError(e.response?.data?.message||"Không thể xóa danh mục.")}};
 return <div className="category-page">
  <div className="section-title"><div><h1>Danh mục</h1><p>Quản lý nhóm sản phẩm và nguyên liệu trong kho.</p></div><button className="btn btn-primary" onClick={()=>setModal({mode:"create"})}><FiPlus/> Thêm danh mục</button></div>
  {message&&<div className="manager-form-success">{message}</div>}{error&&<div className="manager-form-error">{error}</div>}
  <section className="card list-card">
   <div className="category-toolbar"><form onSubmit={apply}><FiSearch/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Tìm tên hoặc mô tả danh mục..."/><button className="btn btn-primary">Tìm kiếm</button></form><select value={status} onChange={e=>{setStatus(e.target.value);setPage(1)}}><option value="">Tất cả trạng thái</option><option value="active">Hoạt động</option><option value="inactive">Ngừng sử dụng</option></select><b>{data.pagination.total||0} danh mục</b></div>
   <div className="table-wrap"><table className="category-table"><thead><tr><th>STT</th><th>Tên danh mục</th><th>Mô tả</th><th>Số lượng sản phẩm</th><th>Trạng thái</th><th>Ngày tạo</th><th>Thao tác</th></tr></thead><tbody>
    {loading?<tr><td colSpan="7" className="category-empty">Đang tải...</td></tr>:data.items.length?data.items.map((item,index)=><tr key={item.categoryId}><td>{(page-1)*8+index+1}</td><td><button className="category-name-link" onClick={()=>setModal({mode:"view",item})}><b>{item.categoryName}</b><small>{item.categoryCode}</small></button></td><td className="category-description">{item.description||"—"}</td><td><b>{item.productCount}</b> sản phẩm</td><td><span className={`status ${item.status==="active"?"success":"neutral"}`}>{item.status==="active"?"Hoạt động":"Ngừng sử dụng"}</span></td><td>{formatDate(item.createdAt)}</td><td><div className="category-actions"><button title="Xem" onClick={()=>setModal({mode:"view",item})}><FiEye/></button><button title="Sửa" onClick={()=>setModal({mode:"edit",item})}><FiEdit2/></button><button title={item.status==="active"?"Khóa":"Mở"} onClick={()=>toggle(item)}>{item.status==="active"?<FiLock/>:<FiUnlock/>}</button><button disabled={Number(item.productCount)>0} title={item.productCount>0?"Danh mục đang có sản phẩm":"Xóa"} className="danger" onClick={()=>remove(item)}><FiTrash2/></button></div></td></tr>):<tr><td colSpan="7" className="category-empty">Không có danh mục phù hợp.</td></tr>}
   </tbody></table></div>
   <div className="category-pagination"><span>Hiển thị {data.items.length} trong {data.pagination.total||0} danh mục</span><div><button disabled={page<=1} onClick={()=>setPage(page-1)}>‹</button><b>{page}/{data.pagination.totalPages||1}</b><button disabled={page>=data.pagination.totalPages} onClick={()=>setPage(page+1)}>›</button></div></div>
  </section>
  {modal&&<CategoryModal mode={modal.mode} item={modal.item} onClose={()=>setModal(null)} onSaved={saved}/>}
 </div>;
}
