import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { FiBell, FiCalendar, FiChevronLeft, FiClock, FiGrid, FiHome, FiUser } from "react-icons/fi";
import { profileApi } from "../api/services";
import { clearSession, getSession } from "../utils/auth";
import "../styles/employee-app.css";

const nav=[
  ["/employee/home","Trang chủ",FiHome],
  ["/employee/schedule","Lịch làm",FiCalendar],
  ["/employee/attendance","Chấm công",FiClock],
  ["/employee/profile","Hồ sơ",FiUser],
];
const isSandbox=import.meta.env.VITE_APP_ENV==="sandbox";
const titles={schedule:"Lịch làm việc",attendance:"Chấm công",shift:"Báo cáo ca","shift-inventory":"Kiểm kho ca",payroll:"Lương của tôi",expenses:"Chi phí","shift-closing":"Đóng ca","shift-report":"Báo cáo ca","shift-registration":"Đăng ký ca","leave-request":"Xin nghỉ",notifications:"Thông báo","notification-center":"Thông báo",profile:"Hồ sơ"};

export default function EmployeeLayout(){
  const navigate=useNavigate(),location=useLocation();
  const {role}=getSession(),canReturnToManager=role==="manager"||role==="admin";
  const [profile,setProfile]=useState(null),[loading,setLoading]=useState(true);
  const page=location.pathname.split("/").pop(),home=page==="home";
  useEffect(()=>{profileApi.get().then(r=>setProfile(r.data)).catch(()=>{}).finally(()=>setLoading(false))},[]);
  const initials=(profile?.fullName||"NV").split(/\s+/).slice(-2).map(x=>x[0]).join("").toUpperCase();
  function logout(){clearSession();navigate("/login",{replace:true})}
  return <div className="emp-app">
    <header className={`emp-header ${home?"emp-header-home":""}`}>
      {home?<><div className="emp-avatar">{profile?.avatarUrl?<img src={profile.avatarUrl} alt=""/>:initials}</div><div className="emp-greeting"><small>Xin chào</small><strong>{profile?.fullName|| (loading?"Đang tải...":"Nhân viên")}</strong><span>{[profile?.position,profile?.branchName].filter(Boolean).join(" · ")}</span></div></>:<>
        <button className="emp-icon-button" onClick={()=>navigate(page==="shift"?"/employee/home":-1)} aria-label="Quay lại"><FiChevronLeft/></button>
        <h1>{titles[page]||"Gà Đại Ca"}</h1><span className="emp-header-spacer"/>
      </>}
      {canReturnToManager&&<button className="emp-icon-button" onClick={()=>navigate("/manager/dashboard")} aria-label="Quay lại quản lý" title="Quay lại quản lý"><FiGrid/></button>}
      <button className="emp-icon-button emp-bell" onClick={()=>navigate("/employee/notification-center")} aria-label="Thông báo"><FiBell/></button>
    </header>
    <main className="emp-content"><Outlet context={{profile,loading,logout}}/></main>
    <nav className="emp-bottom-nav">{nav.map(([to,label,Icon])=><NavLink key={to} to={to}><Icon/><span>{label}</span></NavLink>)}</nav>
  </div>
}
