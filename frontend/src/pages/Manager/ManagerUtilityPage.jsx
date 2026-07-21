import { FiBell, FiBox, FiClipboard, FiPackage, FiSave, FiSettings, FiTag, FiTruck } from "react-icons/fi";

const configs = {
  exports: { title:"Xuất hàng", text:"Theo dõi các phiếu xuất kho trong ngày.", icon:FiClipboard, rows:[["PX-0722-012","Chi nhánh Quận 3","22/07/2026","4.250.000đ","Đã xuất"],["PX-0722-011","Bếp trung tâm","22/07/2026","2.180.000đ","Đang xử lý"],["PX-0721-010","Chi nhánh Bình Thạnh","21/07/2026","6.730.000đ","Đã xuất"]] },
  categories: { title:"Danh mục", text:"Sắp xếp nhóm sản phẩm và nguyên liệu.", icon:FiTag, rows:[["DM001","Gà rán","12 sản phẩm","Đang sử dụng"],["DM002","Đồ uống","8 sản phẩm","Đang sử dụng"],["DM003","Ăn kèm","6 sản phẩm","Đang sử dụng"]] },
  suppliers: { title:"Nhà cung cấp", text:"Quản lý đối tác cung ứng của cửa hàng.", icon:FiTruck, rows:[["NCC001","Thực phẩm ABC","0908 111 222","Nguyên liệu"],["NCC002","PepsiCo Việt Nam","028 3829 2222","Đồ uống"],["NCC003","Nông sản Minh Phát","0912 333 555","Rau củ"]] },
};

export default function ManagerUtilityPage({ type }) {
  if(type === "notifications") return <section className="card list-card utility-page"><div className="section-title"><div><h2>Thông báo</h2><p>Các cập nhật mới nhất trong hệ thống.</p></div><FiBell/></div>{[["Kho hàng","12 sản phẩm sắp chạm mức tồn kho tối thiểu.","10 phút trước"],["Nhân sự","Có 2 yêu cầu nghỉ phép đang chờ duyệt.","1 giờ trước"],["Đơn hàng","Doanh thu hôm nay đã vượt mục tiêu 12%.","3 giờ trước"]].map(x=><article className="utility-notice" key={x[0]}><span><FiBell/></span><div><b>{x[0]}</b><p>{x[1]}</p><small>{x[2]}</small></div></article>)}</section>;
  if(type === "settings") return <section className="card list-card utility-page"><div className="section-title"><div><h2>Cài đặt</h2><p>Cấu hình thông tin cửa hàng.</p></div><FiSettings/></div><form className="settings-form"><label>Tên cửa hàng<input defaultValue="Đại Gà - Chi nhánh Quận 1"/></label><label>Số điện thoại<input defaultValue="028 3822 2026"/></label><label>Địa chỉ<input defaultValue="125 Nguyễn Huệ, Quận 1, TP.HCM"/></label><button type="button" className="btn btn-primary"><FiSave/> Lưu thay đổi</button></form></section>;
  const config=configs[type], Icon=config.icon;
  return <section className="card list-card utility-page"><div className="section-title"><div><h2>{config.title}</h2><p>{config.text}</p></div><button className="btn btn-primary"><Icon/> Thêm mới</button></div><div className="table-wrap"><table><thead><tr><th>Mã</th><th>Tên / Nơi nhận</th><th>Thông tin</th><th>Trạng thái / Nhóm</th></tr></thead><tbody>{config.rows.map(r=><tr key={r[0]}>{r.map((x,i)=><td key={i}>{i===0?<b>{x}</b>:x}</td>)}</tr>)}</tbody></table></div></section>;
}
