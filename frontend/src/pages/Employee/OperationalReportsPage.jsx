import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { FiClipboard, FiPackage, FiRefreshCw } from "react-icons/fi";
import { branchReportApi } from "../../api/services";
import VietnamDateInput from "../../components/VietnamDateInput";

const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh" }).format(new Date());
const types = {
  HYGIENE: ["Báo cáo vệ sinh", FiClipboard, "Khu vực đã vệ sinh, vấn đề phát hiện và việc cần xử lý..."],
  GOODS: ["Báo cáo hàng hóa", FiPackage, "Hàng thiếu, hư hỏng, gần hết hạn hoặc cần nhập thêm..."],
};

export default function OperationalReportsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedType = searchParams.get("type")?.toUpperCase();
  const [type, setType] = useState(types[requestedType] ? requestedType : "HYGIENE");
  const [items, setItems] = useState([]);
  const [form, setForm] = useState({ reportDate: today(), title: "", content: "", image: null });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [label, Icon, placeholder] = types[type];

  const chooseType = value => {
    setType(value);
    setSearchParams({ type: value });
    setError("");
    setMessage("");
  };
  async function load() {
    try {
      setLoading(true);
      const response = await branchReportApi.list({ type });
      setItems(response.data || []);
    } catch (loadError) {
      setError(loadError.response?.data?.message || "Không tải được báo cáo");
    } finally { setLoading(false); }
  }
  useEffect(() => { load(); }, [type]);

  async function submit(event) {
    event.preventDefault();
    try {
      await branchReportApi.create({ ...form, reportType: type });
      setForm({ reportDate: today(), title: "", content: "", image: null });
      setMessage("Đã gửi báo cáo đến quản lý");
      load();
    } catch (submitError) {
      setError(submitError.response?.data?.message || "Không gửi được báo cáo");
    }
  }

  return <div className="operational-reports">
    <nav className="report-type-tabs">
      <button className={type === "HYGIENE" ? "active" : ""} onClick={() => chooseType("HYGIENE")}>Vệ sinh</button>
      <button className={type === "GOODS" ? "active" : ""} onClick={() => chooseType("GOODS")}>Hàng hóa</button>
    </nav>
    <section className="card operational-report-head">
      <div><Icon/><div><h1>{label}</h1><p>Báo cáo được gửi đúng chi nhánh của bạn.</p></div></div>
      <button className="btn btn-light" onClick={load}><FiRefreshCw/> Tải lại</button>
    </section>
    <section className="operational-report-grid">
      <form className="card operational-report-form" onSubmit={submit}>
        <h2>Tạo báo cáo mới</h2>
        {error && <div className="manager-form-error">{error}</div>}
        {message && <div className="manager-form-success">{message}</div>}
        <label>Ngày báo cáo *<VietnamDateInput required value={form.reportDate} onChange={event => setForm(value => ({ ...value, reportDate: event.target.value }))}/></label>
        <label>Tiêu đề *<input required maxLength="200" value={form.title} onChange={event => setForm(value => ({ ...value, title: event.target.value }))}/></label>
        <label>Nội dung *<textarea required rows="7" maxLength="2000" placeholder={placeholder} value={form.content} onChange={event => setForm(value => ({ ...value, content: event.target.value }))}/></label>
        <label>Ảnh minh chứng<input type="file" accept="image/jpeg,image/png,image/webp" onChange={event => setForm(value => ({ ...value, image: event.target.files[0] || null }))}/></label>
        <button className="emp-button">Gửi báo cáo</button>
      </form>
      <section className="operational-report-list">
        {loading ? <div className="card emp-empty">Đang tải...</div> : items.length ? items.map(item => <article className="card" key={item.id}>
          <header><div><b>{item.title}</b><small>{item.reportDate.split("-").reverse().join("/")}</small></div><span className={`report-status ${item.status}`}>{item.status === "approved" ? "Đã duyệt" : item.status === "needs_action" ? "Cần xử lý" : "Chờ duyệt"}</span></header>
          <p>{item.content}</p>
          {item.attachments?.length > 0 && <small>{item.attachments.length} ảnh đính kèm</small>}
          <footer><span>Người gửi: <b>{item.createdBy}</b></span></footer>
        </article>) : <div className="card emp-empty">Chưa có báo cáo.</div>}
      </section>
    </section>
  </div>;
}
