import { useEffect, useState } from "react";
import { FiBell } from "react-icons/fi";
import { employeeApi } from "../../api/services";
import { apiError, shortDate, time } from "../../utils/employeeFormat";
export default function NotificationsPage(){const [items,setItems]=useState([]),[error,setError]=useState("");useEffect(()=>{employeeApi.notifications().then(r=>setItems(r.data||[])).catch(e=>setError(apiError(e)))},[]);
  async function read(item){if(item.isRead)return;try{await employeeApi.readNotification(item.id);setItems(v=>v.map(x=>x.id===item.id?{...x,isRead:true}:x))}catch(e){setError(apiError(e))}}
  return <div>{error&&<div className="emp-error">{error}</div>}<section className="emp-card">{items.length?<div className="emp-list">{items.map(x=><button style={{textAlign:"left",cursor:"pointer"}} className="emp-list-item" key={x.id} onClick={()=>read(x)}><span className="emp-dot" style={{opacity:x.isRead?.35:1}}/><div><b>{x.title}</b><small>{x.content}</small><small>{shortDate(x.createdAt)} · {time(x.createdAt)}</small></div>{!x.isRead&&<span className="emp-badge">Mới</span>}</button>)}</div>:<div className="emp-empty"><FiBell/><div>Chưa có thông báo</div></div>}</section></div>}
