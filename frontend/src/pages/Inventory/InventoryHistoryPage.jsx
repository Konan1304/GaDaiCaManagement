import { useEffect, useMemo, useState } from "react";
import { FiEdit2, FiPlus, FiSearch, FiTrash2, FiX } from "react-icons/fi";
import { categoryApi, productApi, unitApi } from "../../api/services";

const blank={productCode:"",productName:"",categoryId:"",unitId:"",productType:"ingredient",salePrice:0,costPrice:0,minimumStock:0,imageUrl:"",description:"",status:"active"};
const types={sale_item:"Món bán",ingredient:"Nguyên liệu",packaging:"Bao bì"};
const statuses={active:"Hoạt động",inactive:"Ngừng sử dụng",out_of_stock:"Hết hàng"};
const money=v=>new Intl.NumberFormat("vi-VN").format(Number(v||0))+"đ";
const rows=v=>Array.isArray(v?.data)?v.data:Array.isArray(v?.data?.items)?v.data.items:Array.isArray(v?.items)?v.items:[];

function Editor({product,categories,units,onClose,onSaved}){
  const [form,setForm]=useState(product?{...blank,...product,categoryId:String(product.categoryId),unitId:String(product.unitId)}:blank);
  const [saving,setSaving]=useState(false),[error,setError]=useState("");
  const change=e=>setForm(v=>({...v,[e.target.name]:e.target.value}));
  const submit=async e=>{e.preventDefault();setSaving(true);setError("");try{const payload={...form,categoryId:Number(form.categoryId),unitId:Number(form.unitId),salePrice:Number(form.salePrice||0),costPrice:Number(form.costPrice||0),minimumStock:Number(form.minimumStock||0)};product?await productApi.update(product.id,payload):await productApi.create(payload);onSaved(product?"Đã cập nhật sản phẩm.":"Đã thêm sản phẩm.")}catch(err){setError(err.response?.data?.message||"Không thể lưu sản phẩm.")}finally{setSaving(false)}};
  return <div className="manager-modal-backdrop" onMouseDown={e=>e.target===e.currentTarget&&onClose()}><form className="employee-modal product-editor-modal" onSubmit={submit}>
    <header><div><h2>{product?"Chỉnh sửa sản phẩm":"Thêm sản phẩm"}</h2><p>Dùng chung cho tổng kho, nhập hàng và xuất hàng.</p></div><button type="button" onClick={onClose}><FiX/></button></header>
    <div className="product-editor-body">{error&&<div className="manager-form-error">{error}</div>}<div className="product-editor-grid">
      <label>Mã sản phẩm *<input name="productCode" required value={form.productCode} onChange={change}/></label><label>Tên sản phẩm *<input name="productName" required value={form.productName} onChange={change}/></label>
      <label>Danh mục *<select name="categoryId" required value={form.categoryId} onChange={change}><option value="">Chọn danh mục</option>{categories.map(x=><option key={x.categoryId} value={x.categoryId}>{x.categoryName}</option>)}</select></label>
      <label>Đơn vị tính *<select name="unitId" required value={form.unitId} onChange={change}><option value="">Chọn đơn vị</option>{units.map(x=><option key={x.id} value={x.id}>{x.unitName}</option>)}</select></label>
      <label>Loại sản phẩm<select name="productType" value={form.productType} onChange={change}>{Object.entries(types).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></label><label>Trạng thái<select name="status" value={form.status} onChange={change}>{Object.entries(statuses).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></label>
      <label>Giá vốn<input name="costPrice" type="number" min="0" value={form.costPrice} onChange={change}/></label><label>Giá bán<input name="salePrice" type="number" min="0" value={form.salePrice} onChange={change}/></label><label>Mức cảnh báo tồn<input name="minimumStock" type="number" min="0" step="0.001" value={form.minimumStock} onChange={change}/></label><label>URL hình ảnh<input name="imageUrl" value={form.imageUrl||""} onChange={change}/></label>
      <label className="product-description">Mô tả<textarea name="description" rows="3" value={form.description||""} onChange={change}/></label>
    </div></div><footer><button type="button" className="btn" onClick={onClose}>Hủy</button><button className="btn btn-primary" disabled={saving}>{saving?"Đang lưu...":"Lưu sản phẩm"}</button></footer>
  </form></div>;
}

export default function ProductsPage({embedded=false}){
  const [products,setProducts]=useState([]),[categories,setCategories]=useState([]),[units,setUnits]=useState([]),[search,setSearch]=useState(""),[category,setCategory]=useState(""),[status,setStatus]=useState("");
  const [loading,setLoading]=useState(true),[error,setError]=useState(""),[notice,setNotice]=useState(""),[editing,setEditing]=useState(undefined),[deleting,setDeleting]=useState(null);
  const load=async()=>{setLoading(true);setError("");try{const [p,c,u]=await Promise.all([productApi.list(),categoryApi.list({limit:100}),unitApi.list({limit:100})]);setProducts(rows(p));setCategories(rows(c));setUnits(rows(u).map(x=>({id:x.id,unitName:x.unitName||x.unit_name||x.name})));}catch(err){setError(err.response?.data?.message||"Không tải được danh sách sản phẩm.")}finally{setLoading(false)}};
  useEffect(()=>{load()},[]);
  const filtered=useMemo(()=>products.filter(x=>(!search||`${x.productName} ${x.productCode}`.toLowerCase().includes(search.toLowerCase()))&&(!category||String(x.categoryId)===category)&&(!status||x.status===status)),[products,search,category,status]);
  const saved=m=>{setEditing(undefined);setNotice(m);load()};
  const remove=async()=>{try{await productApi.remove(deleting.id);setDeleting(null);setNotice("Đã xóa sản phẩm.");load()}catch(err){setError(err.response?.data?.message||"Không thể xóa sản phẩm.");setDeleting(null)}};
  return <div className={`product-management-panel ${embedded?"embedded":"card"}`}><div className="product-management-head"><div><h3>Quản lý sản phẩm</h3><p>Quản lý thông tin mặt hàng dùng chung trong toàn bộ nghiệp vụ kho.</p></div><button className="btn btn-primary" onClick={()=>setEditing(null)}><FiPlus/> Thêm sản phẩm</button></div>
    {notice&&<div className="manager-form-success">{notice}</div>}{error&&<div className="manager-form-error">{error}</div>}
    <div className="product-filters"><div className="product-search"><FiSearch/><input placeholder="Tìm tên hoặc mã sản phẩm" value={search} onChange={e=>setSearch(e.target.value)}/></div><select value={category} onChange={e=>setCategory(e.target.value)}><option value="">Tất cả danh mục</option>{categories.map(x=><option key={x.categoryId} value={x.categoryId}>{x.categoryName}</option>)}</select><select value={status} onChange={e=>setStatus(e.target.value)}><option value="">Tất cả trạng thái</option>{Object.entries(statuses).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></div>
    <div className="card product-table-card"><div className="inventory-table-head"><h3>Danh sách sản phẩm</h3><p>{filtered.length} sản phẩm</p></div><div className="table-wrap"><table><thead><tr><th>Sản phẩm</th><th>Danh mục</th><th>ĐVT</th><th>Loại</th><th>Giá vốn</th><th>Giá bán</th><th>Mức cảnh báo</th><th>Trạng thái</th><th>Thao tác</th></tr></thead><tbody>{!loading&&filtered.length?filtered.map(x=><tr key={x.id}><td><b>{x.productName}</b><small>{x.productCode}</small></td><td>{x.categoryName}</td><td>{x.unitName}</td><td>{types[x.productType]||x.productType}</td><td>{money(x.costPrice)}</td><td><b>{money(x.salePrice)}</b></td><td>{Number(x.minimumStock||0)}</td><td><span className={`product-state ${x.status}`}>{statuses[x.status]||x.status}</span></td><td><div className="product-actions"><button title="Sửa" onClick={()=>setEditing(x)}><FiEdit2/></button><button className="danger" title="Xóa" onClick={()=>setDeleting(x)}><FiTrash2/></button></div></td></tr>):<tr><td colSpan="9" className="empty-cell">{loading?"Đang tải sản phẩm...":"Không tìm thấy sản phẩm."}</td></tr>}</tbody></table></div></div>
    {editing!==undefined&&<Editor product={editing} categories={categories} units={units} onClose={()=>setEditing(undefined)} onSaved={saved}/>} {deleting&&<div className="manager-modal-backdrop"><div className="employee-modal product-delete-modal"><header><div><h2>Xóa sản phẩm?</h2><p>{deleting.productName}</p></div><button onClick={()=>setDeleting(null)}><FiX/></button></header><div className="product-delete-body">Chỉ xóa được sản phẩm chưa phát sinh dữ liệu kho, nhập hoặc xuất.</div><footer><button className="btn" onClick={()=>setDeleting(null)}>Hủy</button><button className="btn product-delete-confirm" onClick={remove}>Xóa sản phẩm</button></footer></div></div>}
  </div>;
}
