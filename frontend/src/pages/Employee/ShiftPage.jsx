import { useEffect, useState } from "react";
import { employeeApi } from "../../api/services";
import { apiError, money, time } from "../../utils/employeeFormat";
export default function ShiftPage(){const [session,setSession]=useState(null),[openingCash,setOpeningCash]=useState(""),[note,setNote]=useState(""),[message,setMessage]=useState(""),[error,setError]=useState("");
  const load=()=>employeeApi.shiftSession().then(r=>setSession(r.data)).catch(e=>setError(apiError(e)));useEffect(load,[]);
  async function submit(e){e.preventDefault();setError("");try{const r=await employeeApi.openShift({openingCash:Number(openingCash),note});setMessage(r.message);await load()}catch(x){setError(apiError(x))}}
  return <div>{message&&<div className="emp-toast">{message}</div>}{error&&<div className="emp-error">{error}</div>}
    {session?<section className="emp-card"><span className="emp-badge success">Đang mở</span><h2>{session.shiftName}</h2><p>{session.branchName} · {session.positionName}</p><div className="emp-time-row"><div><small>Mở lúc</small><strong>{time(session.openedAt)}</strong></div><div><small>Tiền đầu ca</small><strong style={{fontSize:18}}>{money(session.openingCash)}</strong></div></div></section>:
    <form className="emp-card emp-form" onSubmit={submit}><h2>Mở ca làm việc</h2><label>Tiền đầu ca<input type="number" min="0" required value={openingCash} onChange={e=>setOpeningCash(e.target.value)} placeholder="0"/></label><label>Ghi chú<textarea value={note} onChange={e=>setNote(e.target.value)}/></label><button className="emp-button">Mở ca</button></form>}</div>}
