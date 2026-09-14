import { useEffect, useState } from "react";
import { FiCheckCircle, FiClipboard, FiPackage, FiRefreshCw } from "react-icons/fi";
import { branchReportApi, managerEmployeeApi } from "../../api/services";

const info = {
  HYGIENE: { title: "Báo cáo vệ sinh", icon: FiClipboard },
  GOODS: { title: "Báo cáo hàng hóa", icon: FiPackage },
};

export default function OperationalReports({ type }) {
  const [branches, setBranches] = useState([]);
  const [branchId, setBranchId] = useState("");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const meta = info[type];
  const Icon = meta.icon;

  async function load() {
    try {
      setLoading(true);
      setError("");
      const response = await branchReportApi.list({ type, ...(branchId ? { branchId } : {}) });
      setItems(response.data || []);
    } catch (loadError) {
      setError(loadError.response?.data?.message || "Không tải được báo cáo");
    } finally { setLoading(false); }
  }

  useEffect(() => {
    managerEmployeeApi.branches().then(response => setBranches(response.data || [])).catch(() => {});
  }, []);
  useEffect(() => { load(); }, [type, branchId]);

  async function review(id, status) {
    try {
      setError("");
      await branchReportApi.review(id, status);
      await load();
    } catch (reviewError) {
      setError(reviewError.response?.data?.message || "Không thể cập nhật báo cáo");
    }
  }

  async function exportFile(format) {
    try {
      const blob = await branchReportApi.exportFile(format, { type, ...(branchId ? { branchId } : {}) });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `bao-cao-${type.toLowerCase()}.${format}`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (exportError) {
      setError(exportError.response?.data?.message || "Không thể xuất báo cáo");
    }
  }

  return <div className="operational-reports manager-operational-reports">
    <section className="card operational-report-head">
      <div><Icon/><div><h1>{meta.title}</h1><p>Admin chỉ xem, lọc và duyệt báo cáo do nhân viên gửi.</p></div></div>
      <label>Chi nhánh<select value={branchId} onChange={event => setBranchId(event.target.value)}><option value="">Tất cả chi nhánh</option>{branches.map(branch => <option key={branch.id} value={branch.id}>{branch.branchName}</option>)}</select></label>
      <button className="btn btn-light" onClick={() => exportFile("xlsx")}>Excel</button>
      <button className="btn btn-light" onClick={() => exportFile("pdf")}>PDF</button>
      <button className="btn btn-light" onClick={load}><FiRefreshCw/> Tải lại</button>
    </section>
    {error && <div className="manager-form-error">{error}</div>}
    <section className="operational-report-list manager-report-review-list">
      {loading ? <div className="card empty-state">Đang tải...</div> : items.length ? items.map(item => <article className="card" key={item.id}>
        <header><div><b>{item.title}</b><small>{item.branchName} · {item.reportDate.split("-").reverse().join("/")}</small></div><span className={`report-status ${item.status}`}>{item.status === "approved" ? "Đã duyệt" : item.status === "needs_action" ? "Cần xử lý" : "Chờ duyệt"}</span></header>
        <p>{item.content}</p>
        {item.attachments?.length > 0 && <small>{item.attachments.length} ảnh đính kèm</small>}
        <footer><span>Người gửi: <b>{item.createdBy}</b>{item.score != null && <> · Điểm: <b>{item.score}/100</b></>}</span>{item.status === "submitted" && <div><button onClick={() => review(item.id, "needs_action")}>Cần xử lý</button><button className="approve" onClick={() => review(item.id, "approved")}><FiCheckCircle/> Duyệt</button></div>}</footer>
      </article>) : <div className="card empty-state">Chưa có báo cáo.</div>}
    </section>
  </div>;
}
