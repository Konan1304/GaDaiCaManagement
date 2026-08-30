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

export default function Sidebar({open,onClose,onLogout,user}){
  return <aside className={`sidebar ${open?"open":""}`}>
    <div className="brand"><span className="brand-mark">GĐC</span><div><strong>GÀ ĐẠI CA</strong><small>MANAGEMENT</small></div><button className="icon-btn mobile-close" onClick={onClose}><FiX/></button></div>
    <nav className="sidebar-nav">{menuGroups.map(group=><section className="sidebar-menu-group" key={group.title}>
      <h2>{group.title}</h2>
      <div>{group.items.map(([to,label,Icon])=><NavLink key={to} to={to} onClick={onClose} className={({isActive})=>`nav-link ${isActive?"active":""}`}><Icon/>{label}</NavLink>)}</div>
    </section>)}</nav>
    <div className="sidebar-user"><div className="avatar admin-brand-avatar"><img src="/admin-avatar.png" alt="Gà Đại Ca"/></div><div><strong>{user?.name||"Quốc Anh"}</strong><small>{user?.position||"Quản lý cửa hàng"}</small></div><NavLink className="sidebar-logout" title="Chấm công cá nhân" aria-label="Chấm công cá nhân" to="/employee/attendance" onClick={onClose}><FiClock/></NavLink><button className="sidebar-logout" title="Đăng xuất" onClick={onLogout}><FiLogOut/></button></div>
  </aside>;
}
