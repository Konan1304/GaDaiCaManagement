import { useState } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import Header from "../components/Header";
import { clearSession, getSession } from "../utils/auth";
export default function ManagerLayout(){const [open,setOpen]=useState(false),navigate=useNavigate(),{user}=getSession();const logout=()=>{clearSession();navigate("/login",{replace:true})};return <div className="app-shell"><Sidebar open={open} onClose={()=>setOpen(false)} onLogout={logout} user={user}/>{open&&<div className="overlay" onClick={()=>setOpen(false)}/>}<div className="app-main"><Header onMenu={()=>setOpen(true)} user={user}/><main className="page-content"><Outlet/></main></div></div>}
