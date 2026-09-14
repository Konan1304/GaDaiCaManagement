import {useEffect,useState} from "react";
import {FiPlus,FiTrash2} from "react-icons/fi";
import {importApi} from "../../api/services";
import VietnamDateInput from "../../components/VietnamDateInput";
import "../../styles/shift-inventory.css";

const empty=()=>({productId:"",orderedQuantity:"",note:""});

export default function ReceiveGoodsPage(){
 const [options,setOptions]=useState({branch:{},suppliers:[],products:[]});
 const [form,setForm]=useState({supplierId:"",receiptDate:new Date().toISOString().slice(0,10),note:"",items:[empty()]});
 const [image,setImage]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState(""),[message,setMessage]=useState("");
 useEffect(()=>{importApi.employeeOptions().then(r=>setOptions(r.data)).catch(e=>setError(e.response?.data?.message||"Không tải được dữ liệu nhận hàng."))},[]);
 const item=(index,key,value)=>setForm(current=>({...current,items:current.items.map((row,i)=>i===index?{...row,[key]:value}:row)}));
 const otherSupplier=form.supplierId==="other";
 const submit=async event=>{event.preventDefault();if(otherSupplier&&!form.note.trim()){setError("Khi chọn nhà cung cấp Khác, nhân viên bắt buộc phải ghi rõ nhà cung cấp trong phần ghi chú.");return}if(form.items.filter(row=>row.productId==="other").length>1){setError("Mỗi phiếu chỉ thêm một dòng nguyên liệu Khác; hãy ghi đầy đủ nội dung trong dòng đó.");return}if(form.items.some(row=>row.productId==="other"&&!row.note.trim())){setError("Khi chọn nguyên liệu Khác, nhân viên bắt buộc phải ghi rõ tên và quy cách nguyên liệu.");return}if(!image){setError("Bắt buộc chụp hoặc tải ảnh phiếu giao nhận.");return}try{setBusy(true);setError("");const result=await importApi.employeeCreate({...form,supplierId:otherSupplier?null:Number(form.supplierId),otherSupplier,items:form.items.map(row=>({...row,productId:row.productId==="other"?null:Number(row.productId),otherProduct:row.productId==="other",orderedQuantity:Number(row.orderedQuantity)}))});await importApi.employeeDocument(result.data.receiptId,image);setMessage(`${result.message} Mã phiếu: ${result.data.receiptCode}`);setForm({...form,supplierId:"",note:"",items:[empty()]});setImage(null)}catch(e){setError(e.response?.data?.message||"Không thể gửi phiếu nhập hàng.")}finally{setBusy(false)}};
 return <div className="si-page">
  <section className="si-hero"><span className="si-badge">NHẬN HÀNG TRONG CA</span><h2>Tạo phiếu nhập hàng vào kho</h2><p>{options.branch.branchName||"Chi nhánh theo hồ sơ nhân viên"} · Gửi Admin duyệt trước khi cộng kho</p></section>
  {message&&<p className="si-ok">{message}</p>}{error&&<p className="si-error">{error}</p>}
  <form className="si-card employee-receipt-form" onSubmit={submit}>
   <div className="employee-receipt-head">
    <label>Nhà cung cấp *<select required value={form.supplierId} onChange={e=>setForm({...form,supplierId:e.target.value})}><option value="">Chọn nhà cung cấp</option>{options.suppliers.map(x=><option key={x.supplierId} value={x.supplierId}>{x.supplierName}</option>)}<option value="other">Khác</option></select></label>
    <label>Ngày nhận hàng *<VietnamDateInput required value={form.receiptDate} onChange={e=>setForm({...form,receiptDate:e.target.value})}/></label>
   </div>
   <div className="si-section-title"><h3>Hàng nhận từ nhà cung cấp</h3><button type="button" className="si-secondary" onClick={()=>setForm({...form,items:[...form.items,empty()]})}><FiPlus/> Thêm dòng</button></div>
   <div className="employee-receipt-items">{form.items.map((row,index)=><div className="employee-receipt-row" key={index}>
    <label>Nguyên liệu *<select required value={row.productId} onChange={e=>item(index,"productId",e.target.value)}><option value="">Chọn nguyên liệu</option>{options.products.map(x=><option key={x.productId} value={x.productId}>{x.productCode} - {x.productName} · {x.specification||x.unitName}</option>)}<option value="other">Khác</option></select>{row.productId==="other"&&<input required placeholder="Tên nguyên liệu và quy cách *" value={row.note} onChange={e=>item(index,"note",e.target.value)}/>}</label>
    <label>Số lượng đặt *<input required min=".001" step=".001" type="number" value={row.orderedQuantity} onChange={e=>item(index,"orderedQuantity",e.target.value)}/></label>
    <button type="button" disabled={form.items.length===1} onClick={()=>setForm({...form,items:form.items.filter((_,i)=>i!==index)})}><FiTrash2/></button>
   </div>)}</div>
   <label className="si-receipt-note">Ghi chú{otherSupplier?" *":""}<textarea required={otherSupplier} placeholder={otherSupplier?"Bắt buộc ghi rõ tên nhà cung cấp và thông tin cần thiết":"Ghi chú nếu có"} value={form.note} onChange={e=>setForm({...form,note:e.target.value})}/>{otherSupplier&&<small>Đã chọn “Khác”, vui lòng ghi rõ nhà cung cấp.</small>}</label>
   <label className="si-upload">Ảnh phiếu giao nhận *<input type="file" accept="image/*" capture="environment" onChange={e=>setImage(e.target.files?.[0]||null)}/></label>
   {image&&<p>{image.name}</p>}
   <div className="si-actions"><button disabled={busy} className="si-primary">{busy?"Đang gửi...":"Gửi Admin duyệt"}</button></div>
  </form>
 </div>;
}
