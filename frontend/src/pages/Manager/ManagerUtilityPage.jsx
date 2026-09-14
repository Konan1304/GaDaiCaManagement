import { useEffect, useState } from "react";
import { FiLogOut, FiRefreshCw, FiSave, FiSettings } from "react-icons/fi";
import { useNavigate } from "react-router-dom";
import { settingsApi } from "../../api/services";
import { clearSession } from "../../utils/auth";

const vn = value => new Intl.DateTimeFormat("vi-VN", { timeZone:"Asia/Ho_Chi_Minh", dateStyle:"short", timeStyle:"medium" }).format(new Date(value));

export default function ManagerUtilityPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ store_name:"", support_phone:"", head_office_address:"", timezone:"Asia/Ho_Chi_Minh" });
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function load() {
    try {
      setLoading(true);
      const [settings, audit] = await Promise.all([settingsApi.get(), settingsApi.auditLogs()]);
      setForm(value => ({ ...value, ...settings.data }));
      setLogs(audit.data || []);
    } catch (loadError) {
      setError(loadError.response?.data?.message || "Không tải được cài đặt");
    } finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  async function save(event) {
    event.preventDefault();
    try {
      setSaving(true);
      setError("");
      const response = await settingsApi.update(form);
      setMessage(response.message);
      load();
    } catch (saveError) {
      setError(saveError.response?.data?.message || "Không lưu được cài đặt");
    } finally { setSaving(false); }
  }

  function logout() {
    if (!window.confirm("Bạn có chắc muốn đăng xuất?")) return;
    clearSession();
    navigate("/login", { replace:true });
  }

  return <div style={{ display:"grid", gap:18 }}>
    <section className="card list-card utility-page">
      <div className="section-title"><div><h2>Cài đặt hệ thống</h2><p>Lưu trực tiếp vào database.</p></div><FiSettings/></div>
      {error && <div className="manager-form-error">{error}</div>}
      {message && <div className="manager-form-success">{message}</div>}
      <div className="settings-content-grid"><form className="settings-form" onSubmit={save}>
        <label>Tên cửa hàng<input disabled={loading} value={form.store_name} onChange={event => setForm(value => ({ ...value, store_name:event.target.value }))}/></label>
        <label>Số điện thoại hỗ trợ<input disabled={loading} value={form.support_phone} onChange={event => setForm(value => ({ ...value, support_phone:event.target.value }))}/></label>
        <label>Địa chỉ văn phòng chính<input disabled={loading} value={form.head_office_address} onChange={event => setForm(value => ({ ...value, head_office_address:event.target.value }))}/></label>
        <label>Múi giờ<select value={form.timezone} disabled><option value="Asia/Ho_Chi_Minh">Việt Nam (GMT+7)</option></select></label>
        <button disabled={loading || saving} className="btn btn-primary"><FiSave/> {saving ? "Đang lưu..." : "Lưu thay đổi"}</button>
      </form>
      <aside className="settings-session"><span className="settings-session-icon"><FiLogOut/></span><div><small>TÀI KHOẢN VÀ BẢO MẬT</small><b>Phiên đăng nhập</b><p>Đăng xuất tài khoản quản trị khỏi thiết bị này. Bạn sẽ cần đăng nhập lại để tiếp tục sử dụng hệ thống.</p></div><button type="button" className="btn settings-logout" onClick={logout}><FiLogOut/> Đăng xuất</button></aside></div>
    </section>
    <section className="card list-card">
      <div className="section-title"><div><h2>Nhật ký quản trị</h2><p>100 hoạt động đăng nhập và cấu hình gần nhất.</p></div><button className="btn btn-light" onClick={load}><FiRefreshCw/> Tải lại</button></div>
      <div className="table-wrap"><table><thead><tr><th>Thời gian</th><th>Người dùng</th><th>Hành động</th><th>Đối tượng</th><th>IP</th></tr></thead><tbody>{logs.map(item => <tr key={item.id}><td>{vn(item.createdAt)}</td><td>{item.actorName || "Không xác định"}</td><td>{item.action}</td><td>{item.entityType || "-"} {item.entityId || ""}</td><td>{item.ipAddress || "-"}</td></tr>)}</tbody></table></div>
    </section>
  </div>;
}
