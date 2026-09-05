import {useState} from "react";
import {NavLink} from "react-router-dom";
import {FiBarChart2,FiBell,FiBox,FiCalendar,FiClipboard,FiClock,FiDollarSign,FiGrid,FiLogOut,FiMessageCircle,FiPackage,FiPlusSquare,FiSettings,FiTag,FiUsers,FiX} from "react-icons/fi";

const menuGroups=[
  {title:"TỔNG QUAN",items:[
    ["/manager/dashboard","Tổng quan",FiGrid],
  ]},
  {title:"QUẢN LÝ NHÂN SỰ",items:[
    ["/manager/employees","Nhân viên",FiUsers],
    ["/manager/shift-registration","Đăng ký ca",FiPlusSquare],
    ["/manager/schedules","Lịch làm việc",FiCalendar],
    ["/manager/attendance","Chấm công",FiClock],
    ["/manager/payrolls","Lương",FiDollarSign],
  ]},
  {title:"QUẢN LÝ KHO",items:[
    ["/manager/shift-inventory","Kiểm kho theo ca",FiClipboard],
    ["/manager/inventory","Tổng kho hàng",FiBox],
    ["/manager/categories","Danh mục",FiTag],
    ["/manager/suppliers","Nhà cung cấp",FiPackage],
  ]},
  {title:"QUẢN LÝ CỬA HÀNG",items:[
    ["/manager/operations/dashboard","Báo cáo ca",FiClipboard],
    ["/manager/chat","Chat nội bộ",FiMessageCircle],
    ["/manager/reports","Báo cáo",FiBarChart2],
  ]},
  {title:"HỆ THỐNG",items:[
    ["/manager/notification-center","Thông báo",FiBell],
    ["/manager/settings","Cài đặt",FiSettings],
  ]},
];

export default function Sidebar({open,collapsed,onToggleCollapse,onClose,onLogout,user}){
  const [accountOpen,setAccountOpen]=useState(false);
  return <aside className={`sidebar ${open?"open":""} ${collapsed?"collapsed":""}`}>
    <div className="sidebar-user sidebar-user-top"><button type="button" className="avatar admin-brand-avatar sidebar-logo-toggle" title={collapsed?"Mở thanh menu":"Thu gọn thanh menu"} aria-label={collapsed?"Mở thanh menu":"Thu gọn thanh menu"} onClick={onToggleCollapse}><img src="/admin-avatar.png" alt="Gà Đại Ca"/></button><button type="button" className={`sidebar-account-name ${accountOpen?"open":""}`} onClick={()=>setAccountOpen(value=>!value)} aria-expanded={accountOpen}><strong>{user?.name||"Quốc Anh"}</strong><small>{user?.position||"Quản lý cửa hàng"}</small></button><div className={`sidebar-account-actions ${accountOpen?"open":""}`}><NavLink className="sidebar-logout" title="Chấm công cá nhân" to="/employee/attendance" onClick={()=>{setAccountOpen(false);onClose()}}><FiClock/><span>Chấm công cá nhân</span></NavLink><button className="sidebar-logout" title="Đăng xuất" onClick={onLogout}><FiLogOut/><span>Đăng xuất</span></button></div><button className="icon-btn mobile-close sidebar-mobile-close" onClick={onClose}><FiX/></button></div>
    <nav className="sidebar-nav">{menuGroups.map(group=><section className="sidebar-menu-group" key={group.title}>
      <h2>{group.title}</h2>
      <div>{group.items.map(([to,label,Icon])=><NavLink key={to} to={to} title={collapsed?label:undefined} onClick={onClose} className={({isActive})=>`nav-link ${isActive?"active":""}`}><Icon/><span>{label}</span></NavLink>)}</div>
    </section>)}</nav>
  </aside>;
}
