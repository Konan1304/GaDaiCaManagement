import { useEffect, useState } from "react";
import { FiCamera, FiCheckCircle, FiClock, FiEdit3, FiLock, FiPlayCircle, FiSend, FiUser, FiXCircle } from "react-icons/fi";
import { operationApi } from "../../api/services";
import { apiError, money, time } from "../../utils/employeeFormat";
import { getSession } from "../../utils/auth";
import "../../styles/operation-actions.css";

const labels = { morning: "Ca sáng", evening: "Ca tối" };
const statusLabels = { OPEN:"ĐANG MỞ", REOPENED:"ĐANG MỞ LẠI", WAITING_HANDOVER:"ĐÃ GỬI BÁO CÁO", LOCKED:"ĐÃ KẾT CA" };
const emptyReport = { cashRevenue:0, grabRevenue:0, shopeefoodRevenue:0, beRevenue:0, mposRevenue:0, xanhSmRevenue:0, orderCount:0, actualCash:0, note:"", denominations:{} };
const fields = [["cashRevenue","Tiền mặt"],["beRevenue","Be"],["grabRevenue","Grab"],["shopeefoodRevenue","ShopeeFood"],["mposRevenue","MPOS"],["xanhSmRevenue","Xanh SM"]];

function Report({ session, reload }) {
  const [meta,setMeta]=useState(null), [form,setForm]=useState({...emptyReport}), [images,setImages]=useState([]), [handover,setHandover]=useState(null);
  const [busy,setBusy]=useState(false), [error,setError]=useState(""), [message,setMessage]=useState(""), [confirm,setConfirm]=useState(false), [dirty,setDirty]=useState(false);
  const [receivedCash,setReceivedCash]=useState("1000000"), [receiverNote,setReceiverNote]=useState("");
  const user=getSession().user;
  const key=`operation-draft:${user?.id||"unknown"}:${session.branchId}:${session.businessDate}:${session.operationShift}:${session.shiftSessionId}`;

  async function load(){
    setError("");
    try {
      const [reportResult,cashResult,imageResult,handoverResult]=await Promise.all([
        operationApi.report(session.shiftSessionId), operationApi.cashCount(session.shiftSessionId), operationApi.attachments(session.shiftSessionId), operationApi.handover(session.shiftSessionId)
      ]);
      const nextMeta=reportResult?.data||{};
      const cashItems=Array.isArray(cashResult?.data?.items)?cashResult.data.items:[];
      const denominations=cashItems.reduce((result,item)=>({...result,[item.denomination]:item.quantity}),{});
      const serverForm=nextMeta.report?{...emptyReport,...nextMeta.report,denominations}:{...emptyReport,actualCash:Number(session.openingCash||0),denominations};
      let localForm=null;
      try { localForm=JSON.parse(localStorage.getItem(key)); } catch { localStorage.removeItem(key); }
      setMeta({...nextMeta,denominations:Array.isArray(nextMeta.denominations)?nextMeta.denominations:[]});
      setImages(Array.isArray(imageResult?.data)?imageResult.data:[]);
      setHandover(handoverResult?.data||null);
      setForm(localForm?{...serverForm,...localForm,denominations:{...denominations,...(localForm.denominations||{})}}:serverForm);
    } catch (requestError) {
      setError(apiError(requestError));
      setMeta({canEdit:false,report:null,denominations:[]});
    }
  }
  useEffect(()=>{load()},[session.shiftSessionId]);
  useEffect(()=>{if(!dirty)return;localStorage.setItem(key,JSON.stringify(form));const warn=e=>{e.preventDefault();e.returnValue=""};window.addEventListener("beforeunload",warn);return()=>window.removeEventListener("beforeunload",warn)},[form,dirty,key]);

  const actual=Number(form.actualCash||0);
  const expected=Number(session.openingCash||0);
  const deposit=Number(form.cashRevenue||0);
  const totalPayment=fields.reduce((sum,[name])=>sum+Number(form[name]||0),0);
  const locked=!meta?.canEdit||!["OPEN","REOPENED"].includes(session.status);
  const setValue=(name,value)=>{setForm(current=>({...current,[name]:value}));setDirty(true)};
  const setCount=(denomination,value)=>{setForm(current=>({...current,denominations:{...(current.denominations||{}),[denomination]:Math.max(0,Number(value)||0)}}));setDirty(true)};

  async function save(submit=false){setBusy(true);setError("");try{const payload={...form,version:meta?.report?.version};const result=submit?await operationApi.submitReport(session.shiftSessionId,payload):await operationApi.saveReport(session.shiftSessionId,payload);localStorage.removeItem(key);setDirty(false);setMessage(result.message);setConfirm(false);await load();if(submit)await reload()}catch(e){setError(apiError(e))}finally{setBusy(false)}}
  async function upload(event){const file=event.target.files?.[0];if(!file)return;setBusy(true);try{await operationApi.uploadAttachment(session.shiftSessionId,file,"pos_screen");setMessage("Đã tải ảnh POS");await load()}catch(e){setError(apiError(e))}finally{setBusy(false);event.target.value=""}}
  async function receive(status){setBusy(true);try{await operationApi.receiveHandover(session.shiftSessionId,{actualReceivedCash:Number(receivedCash||0),status,receiverNote});setMessage("Đã xử lý bàn giao");await reload()}catch(e){setError(apiError(e))}finally{setBusy(false)}}

  if(!meta)return <section className="operation-report"><div className="emp-empty">Đang tải báo cáo...</div></section>;
  return <section className="operation-report" id={`shift-closing-${session.shiftSessionId}`}>
    <div className="operation-report-head"><div><small>KẾT CA VÀ GỬI BÁO CÁO</small><h3>Kết {labels[session.operationShift]?.toLowerCase()} · {session.businessDate}</h3><p>Nhập số thu trong ca hiện tại, kiểm tra quỹ rồi kết ca.</p></div><span className={`operation-report-status ${meta.report?.status||"new"}`}>{meta.report?.status||"Chưa lập"}</span></div>
    {message&&<div className="emp-toast">{message}</div>}{error&&<div className="emp-error">{error}</div>}
    {locked&&<div className="operation-readonly"><FiLock/> Báo cáo đã kết ca — bạn được xem lại nhưng không thể chỉnh sửa.</div>}
    <div className="operation-revenue-grid">{fields.map(([name,label])=><label key={name}><span>{label}</span><input type="number" min="0" disabled={locked} value={form[name]??0} onChange={e=>setValue(name,e.target.value)}/><small>{money(form[name])}</small></label>)}<label><span>Đơn hủy</span><input type="number" min="0" step="1" disabled={locked} value={form.orderCount??0} onChange={e=>setValue("orderCount",e.target.value)}/><small>{Number(form.orderCount||0).toLocaleString("vi-VN")} đơn</small></label></div>
    <div className="operation-payment-total"><span>Tổng thanh toán</span><b>{money(totalPayment)}</b><small>Tự động cộng tất cả phương thức thanh toán phía trên</small></div>
    <div className="operation-cash-section"><h4>Kiểm kê quỹ bàn giao</h4><label className="operation-report-note"><span>Quỹ tiền mặt thực tế còn lại</span><input type="number" min="0" disabled={locked} value={form.actualCash??0} onChange={e=>setValue("actualCash",e.target.value)}/><small>Chỉ nhập tiền quỹ cần giữ lại, không cộng doanh thu tiền mặt.</small></label></div>
    <div className="operation-totals"><div><small>Quỹ đầu ca cần giữ</small><b>{money(expected)}</b></div><div><small>Quỹ thực tế còn lại</small><b>{money(actual)}</b></div><div className={actual===expected?"balanced":"difference"}><small>Chênh lệch quỹ</small><b>{money(actual-expected)}</b></div><div><small>Tiền bán hàng cần nộp</small><b>{money(deposit)}</b></div></div>
    <label className="operation-report-note"><span>Ghi chú</span><textarea disabled={locked} value={form.note||""} onChange={e=>setValue("note",e.target.value)}/></label>
    <div className="operation-images"><h4>Ảnh chứng từ ({images.length}/10)</h4>{images.map(image=><span key={image.attachmentId}><FiCamera/> {image.originalName}</span>)}{!locked&&<label className="emp-button secondary"><FiCamera/> Thêm ảnh POS<input hidden type="file" accept="image/jpeg,image/png,image/webp" onChange={upload}/></label>}</div>
    {!locked&&<div className="operation-report-actions"><button className="emp-button secondary" disabled={busy} onClick={()=>save(false)}><FiEdit3/> Lưu nháp</button><button className="emp-button" disabled={busy} onClick={()=>setConfirm(true)}><FiSend/> Kết ca & gửi Admin</button></div>}
    {handover&&<div className="operation-handover"><h4>Bàn giao: {handover.status}</h4><p>Tiền dự kiến nhận: <b>{money(handover.expectedOpeningCash)}</b></p>{handover.canReceive&&<><input type="number" value={receivedCash} onChange={e=>setReceivedCash(e.target.value)} placeholder="Tiền thực nhận"/><textarea value={receiverNote} onChange={e=>setReceiverNote(e.target.value)} placeholder="Ghi chú/lý do chênh lệch"/><div><button onClick={()=>receive("ACCEPTED")}>Nhận bàn giao</button><button onClick={()=>receive("DISPUTED")}>Báo tranh chấp</button></div></>}{handover.status==="PENDING"&&!handover.canReceive&&!handover.isSender&&<small>Tài khoản cần có lịch đúng ca tiếp theo và đã chấm công vào.</small>}</div>}
    {confirm&&<div className="operation-confirm"><div><FiSend/><h3>Xác nhận kết ca?</h3><p>Báo cáo sẽ được gửi cho Admin và ca của bạn sẽ hoàn tất. Sau khi kết ca, bạn không thể sửa số liệu.</p><div><button onClick={()=>setConfirm(false)}>Xem lại</button><button className="emp-button" disabled={busy} onClick={()=>save(true)}>Kết ca & gửi Admin</button></div></div></div>}
  </section>;
}

export default function OperationShiftPage(){
  const isSandbox=import.meta.env.VITE_APP_ENV==="sandbox";
  const sandboxDate=isSandbox?localStorage.getItem("sandbox-operation-date")||"":null;
  const [data,setData]=useState(null), [loading,setLoading]=useState(true), [error,setError]=useState(""), [message,setMessage]=useState(""), [mode,setMode]=useState("open");
  async function load(){setLoading(true);setError("");try{const result=await operationApi.current(sandboxDate);setData(result?.data||{shifts:[]})}catch(e){setError(apiError(e));setData({shifts:[]})}finally{setLoading(false)}}
  useEffect(()=>{load()},[]);
  useEffect(()=>{if(mode!=="close")return;const hasReportSession=(data?.shifts||[]).some(item=>item.session);if(data&&!hasReportSession)setMode("open")},[data,mode]);
  async function open(operationShift){try{const result=await operationApi.open({operationShift,...(isSandbox&&sandboxDate?{businessDate:sandboxDate}:{})});setMessage(result.message);await load()}catch(e){setError(apiError(e))}}
  if(loading)return <div className="emp-card emp-empty">Đang kiểm tra ca...</div>;
  const shifts=(Array.isArray(data?.shifts)?data.shifts:[]).filter(item=>item.session||item.eligibility?.hasSchedule);
  const reportSession=shifts.find(item=>item.session)?.session;
  const openSession=shifts.find(item=>item.session&&["OPEN","REOPENED"].includes(item.session.status))?.session;
  return <div className="operation-employee">{message&&<div className="emp-toast">{message}</div>}{error&&<div className="emp-error">{error}</div>}<section className="emp-card operation-heading"><FiClock/><div><small>Ngày nghiệp vụ</small><h2>{data?.businessDate||"Chưa xác định"}</h2></div></section>
    <section className="operation-mode-actions" aria-label="Thao tác báo cáo ca">
      <button className={`operation-mode-button open ${mode==="open"?"active":""}`} onClick={()=>setMode("open")}><FiPlayCircle/><span><small>BẮT ĐẦU LÀM VIỆC</small><b>Mở ca</b><em>Kiểm tra quỹ đầu ca 1.000.000đ</em></span></button>
      <button className={`operation-mode-button close ${mode==="close"?"active":""}`} disabled={!reportSession} onClick={()=>reportSession&&setMode("close")}><FiSend/><span><small>{openSession?"HOÀN TẤT CÔNG VIỆC":"BÁO CÁO ĐÃ GỬI"}</small><b>{openSession?"Kết ca":"Xem báo cáo"}</b><em>{openSession?"Nhập doanh thu và gửi Admin":reportSession?"Chỉ xem, không thể chỉnh sửa":"Bạn cần mở ca trước"}</em></span></button>
    </section>
    {!shifts.length&&!error&&<section className="emp-card emp-empty">Chưa có ca vận hành trong ngày này.</section>}
    {mode==="open"&&<div className="operation-cards" id="shift-opening">{shifts.map(item=>{const eligibility=item.eligibility||{allowed:false,reasons:["Chưa đủ điều kiện mở ca"]};return <section className="emp-card operation-card" key={item.operationShift}><div className="operation-card-title"><div><span className="emp-badge">{labels[item.operationShift]||item.operationShift}</span><h2>{item.session?(statusLabels[item.session.status]||item.session.status):"CHƯA MỞ"}</h2></div>{item.session?<FiLock/>:eligibility.allowed?<FiCheckCircle/>:<FiXCircle/>}</div><div className="operation-leader"><FiUser/><div><small>{item.session?"Người đã mở ca":"Bắt đầu ca hiện tại"}</small><b>{item.session?(item.leader?.name||"Không xác định"):(eligibility.allowed?`Mở ${labels[item.operationShift]?.toLowerCase()}`:"Bạn cần chấm công vào trước")}</b></div></div>{item.session?<div className="operation-opening-cash"><small>Quỹ đầu ca</small><b>{money(item.session.openingCash)}</b><span>Ca đã mở lúc {time(item.session.openedAt)}</span></div>:eligibility.allowed?<button className="emp-button" onClick={()=>open(item.operationShift)}><FiPlayCircle/> Mở {labels[item.operationShift]?.toLowerCase()} với quỹ 1.000.000đ</button>:<div className="operation-eligibility denied">{(eligibility.reasons||[]).filter(reason=>!reason.includes("lịch chính thức")).map(reason=><small key={reason}>• {reason}</small>)}</div>}</section>})}</div>}
    {mode==="close"&&shifts.filter(item=>item.session).map(item=><Report key={item.session.shiftSessionId} session={item.session} reload={load}/>)}
  </div>;
}
