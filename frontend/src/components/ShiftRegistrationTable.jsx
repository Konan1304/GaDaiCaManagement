const iso=value=>value instanceof Date
 ? `${value.getFullYear()}-${String(value.getMonth()+1).padStart(2,"0")}-${String(value.getDate()).padStart(2,"0")}`
 : String(value||"").slice(0,10);
const days=["CN","T2","T3","T4","T5","T6","T7"];
export const registrationChoices=[
 {code:"",label:"Không đăng ký (nghỉ)"},{code:"FULL",label:"FULL — Rảnh cả ngày"},
 {code:"A",label:"A — 08:00–16:00"},{code:"B",label:"B — 16:00–23:00"},
 {code:"P1",label:"P1 — 08:00–12:00"},{code:"P2",label:"P2 — 12:00–17:00"},{code:"P3",label:"P3 — 17:00–23:00"}
];

export default function ShiftRegistrationTable({dates,employees,currentEmployeeId,editable=false,values={},onChange}){
 return <div className="weekly-registration-wrap"><table className="weekly-registration-table"><thead><tr><th>Họ tên</th>{dates.map(date=><th key={iso(date)}>{days[date.getDay()]}<small>{date.toLocaleDateString("vi-VN",{day:"2-digit",month:"2-digit"})}</small></th>)}</tr></thead>
  <tbody>{employees.map(employee=>{
   const mine=Number(employee.employeeId)===Number(currentEmployeeId);
   const registered=Object.keys(employee.registrations||{}).length>0;
   return <tr key={employee.employeeId} className={mine?"is-me":""}><th><b>{employee.fullName}</b>{mine&&<em>Bạn</em>}<small>{employee.employeeCode} · {employee.positionName}</small><small className={`registration-row-state ${registered?"registered":"pending"}`}>{registered?"Đã đăng ký":"Chưa đăng ký"}</small></th>{dates.map(date=>{
    const key=iso(date);
    // Sau khi lưu/refetch, luôn dùng dữ liệu database làm fallback để dòng của chính nhân viên không bị trắng.
    const stored=employee.registrations?.[key]||"";
    const code=mine&&editable?(values[key]??(stored==="OFF"?"":stored)):stored;
    return <td key={key} className={`registration-cell code-${(code||"empty").toLowerCase()}`}>{mine&&editable?<select aria-label={`${employee.fullName} ${key}`} value={code} onChange={event=>onChange(key,event.target.value)}>{registrationChoices.map(choice=><option key={choice.code||"empty"} value={choice.code}>{choice.label}</option>)}</select>:<span>{code==="OFF"?"Nghỉ":code||"—"}</span>}</td>
   })}</tr>
  })}</tbody></table></div>
}
