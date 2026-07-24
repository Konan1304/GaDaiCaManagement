import { useEffect, useState } from "react";
import { FiFileText } from "react-icons/fi";
import { employeeApi } from "../../api/services";
import { apiError, money, shortDate } from "../../utils/employeeFormat";
export default function ShiftReportPage(){const [items,setItems]=useState([]),[error,setError]=useState("");useEffect(()=>{employeeApi.shiftReports().then(r=>setItems(r.data||[])).catch(e=>setError(apiError(e)))},[]);return <div>{error&&<div className="emp-error">{error}</div>}<section className="emp-card">{items.length?<div className="emp-list">{items.map(x=><div className="emp-list-item" key={x.reportId}><FiFileText/><div><b>{x.shiftName} · {shortDate(x.businessDate)}</b><small>Doanh thu {money(x.totalRevenue)} · Chi phí {money(x.totalExpense)}</small><small>Chênh lệch {money(x.differenceAmount)}</small></div><span className="emp-badge">{x.status}</span></div>)}</div>:<div className="emp-empty"><FiFileText/><div>Chưa có báo cáo ca</div></div>}</section></div>}
