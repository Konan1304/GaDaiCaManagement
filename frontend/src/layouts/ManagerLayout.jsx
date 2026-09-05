import { useState } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import Header from "../components/Header";
import { clearSession, getSession } from "../utils/auth";
export default function ManagerLayout(){const [open,setOpen]=useState(false),[collapsed,setCollapsed]=useState(()=>localStorage.getItem("managerSidebarCollapsed")==="1"),navigate=useNavigate(),{user}=getSession();const logout=()=>{clearSession();navigate("/login",{replace:true})};const toggleSidebar=()=>setCollapsed(value=>{const next=!value;localStorage.setItem("managerSidebarCollapsed",next?"1":"0");return next});return <div className={`app-shell ${collapsed?"sidebar-is-collapsed":""}`}><Sidebar open={open} collapsed={collapsed} onToggleCollapse={toggleSidebar} onClose={()=>setOpen(false)} onLogout={logout} user={user}/>{open&&<div className="overlay" onClick={()=>setOpen(false)}/>}<div className="app-main"><Header onMenu={()=>setOpen(true)} user={user}/><main className="page-content"><Outlet/></main></div></div>}
