import { FiBell, FiMenu, FiSearch } from "react-icons/fi";
import { useLocation } from "react-router-dom";

const titles = { dashboard:"Tổng quan", employees:"Nhân viên", schedules:"Lịch làm việc", inventory:"Kho hàng", imports:"Nhập hàng", exports:"Xuất hàng", products:"Sản phẩm", categories:"Danh mục", suppliers:"Nhà cung cấp", reports:"Báo cáo", payrolls:"Lương", notifications:"Thông báo", settings:"Cài đặt" };
export default function Header({ onMenu, user }) {
  const key = useLocation().pathname.split("/").pop();
  const date = new Intl.DateTimeFormat("vi-VN", { weekday:"long", day:"2-digit", month:"long", year:"numeric" }).format(new Date());
  return <header className="topbar"><div className="header-title"><button className="icon-btn menu-btn" onClick={onMenu}><FiMenu /></button><div><h1>{titles[key] || "Gà Đại Ca"}</h1><p>{date}</p></div></div><div className="header-actions"><button className="icon-btn"><FiSearch /></button><button className="icon-btn notification"><FiBell /><i /></button><div className="avatar admin-brand-avatar" title={user?.name}><img src="/admin-avatar.png" alt="Gà Đại Ca" /></div></div></header>;
}
