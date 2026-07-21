import { NavLink } from "react-router-dom";
import { FiBarChart2, FiBell, FiBox, FiCalendar, FiClipboard, FiGrid, FiLogOut, FiPackage, FiSettings, FiShoppingBag, FiTag, FiTruck, FiUsers, FiX } from "react-icons/fi";

const items = [
  ["/manager/dashboard", "Tổng quan", FiGrid], ["/manager/employees", "Nhân viên", FiUsers],
  ["/manager/schedules", "Lịch làm việc", FiCalendar], ["/manager/inventory", "Kho hàng", FiBox],
  ["/manager/imports", "Nhập hàng", FiTruck], ["/manager/exports", "Xuất hàng", FiClipboard],
  ["/manager/products", "Sản phẩm", FiShoppingBag], ["/manager/categories", "Danh mục", FiTag],
  ["/manager/suppliers", "Nhà cung cấp", FiPackage], ["/manager/reports", "Báo cáo", FiBarChart2],
  ["/manager/notifications", "Thông báo", FiBell], ["/manager/settings", "Cài đặt", FiSettings],
];

export default function Sidebar({ open, onClose, onLogout, user }) {
  return <aside className={`sidebar ${open ? "open" : ""}`}>
    <div className="brand"><span className="brand-mark">ĐG</span><div><strong>ĐẠI GÀ</strong><small>MANAGEMENT</small></div><button className="icon-btn mobile-close" onClick={onClose}><FiX /></button></div>
    <nav>{items.map(([to, label, Icon]) => <NavLink key={to} to={to} onClick={onClose} className={({isActive}) => `nav-link ${isActive ? "active" : ""}`}><Icon />{label}</NavLink>)}</nav>
    <div className="sidebar-user"><div className="avatar">QA</div><div><strong>{user?.name || "Quốc Anh"}</strong><small>{user?.position || "Quản lý cửa hàng"}</small></div><button className="sidebar-logout" title="Đăng xuất" onClick={onLogout}><FiLogOut/></button></div>
  </aside>;
}
