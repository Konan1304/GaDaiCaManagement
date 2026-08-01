import { useEffect, useMemo, useState } from "react";
import { FiChevronLeft, FiClock, FiDownload, FiEye, FiGitBranch, FiRefreshCw, FiSearch, FiUsers, FiX } from "react-icons/fi";
import { managerEmployeeApi, managerOperationApi } from "../../api/services";
import "../../styles/operation-detail.css";

const cash = value => `${Number(value || 0).toLocaleString("vi-VN")}đ`;
const shiftName = value => value === "morning" ? "CA SÁNG" : "CA TỐI";

function DetailModal({ report, onClose }) {
  if (!report) return null;
  const payments = [
    ["Tiền mặt", report.cashRevenue], ["Be", report.beRevenue], ["Grab", report.grabRevenue],
    ["ShopeeFood", report.shopeefoodRevenue], ["MPOS", report.mposRevenue], ["Xanh SM", report.xanhSmRevenue],
  ];
  return <div className="operation-detail-backdrop" onMouseDown={onClose}>
    <section className="operation-detail-modal" onMouseDown={event => event.stopPropagation()}>
      <header><div><small>CHI TIẾT BÁO CÁO ĐÃ KẾT CA</small><h2>{shiftName(report.operationShift)} · {report.businessDate}</h2><p>Người báo cáo: <b>{report.leaderName}</b></p></div><button onClick={onClose} aria-label="Đóng"><FiX /></button></header>
      <div className="operation-detail-payments">{payments.map(([label, value]) => <div key={label}><small>{label}</small><b>{cash(value)}</b></div>)}</div>
      <div className="operation-detail-total"><span>Tổng thanh toán</span><b>{cash(report.totalRevenue)}</b></div>
      <div className="operation-detail-meta">
        <div><small>Đơn hủy</small><b>{Number(report.orderCount || 0).toLocaleString("vi-VN")} đơn</b></div>
        <div><small>Tiền cần nộp</small><b>{cash(report.cashToDeposit)}</b></div>
        <div className={Number(report.differenceAmount) === 0 ? "balanced" : "difference"}><small>Chênh lệch quỹ</small><b>{cash(report.differenceAmount)}</b></div>
        <div><small>Ảnh chứng từ</small><b>{report.attachmentCount || 0} ảnh</b></div>
      </div>
      <footer><button className="btn btn-dark" onClick={onClose}>Đóng chi tiết</button></footer>
    </section>
  </div>;
}

export default function OperationDashboardPage() {
  const [date, setDate] = useState("2026-06-01");
  const [data, setData] = useState({ items: [], summary: {} });
  const [timeline, setTimeline] = useState([]);
  const [selected, setSelected] = useState(null);
  const [branches, setBranches] = useState([]);
  const [branchId, setBranchId] = useState("");
  const [branchSearch, setBranchSearch] = useState("");
  const [error, setError] = useState("");

  async function load() {
    try {
      setError("");
      const params = { date, branchId: branchId || undefined };
      const [dashboard, events] = await Promise.all([managerOperationApi.dashboard(params), managerOperationApi.timeline(params)]);
      setData(dashboard.data);
      setTimeline(events.data);
    } catch (requestError) {
      setError(requestError.response?.data?.message || requestError.message);
    }
  }
  useEffect(() => { managerEmployeeApi.branches().then(response => setBranches(response.data || [])).catch(() => {}); }, []);
  useEffect(() => { load(); }, [date, branchId]);

  async function download(type) {
    const blob = await managerOperationApi.exportUrl(type, { from: date, to: date, branchId });
    const url = URL.createObjectURL(blob), anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `bao-cao-ca-${date}.${type === "excel" ? "xlsx" : "pdf"}`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  const appRevenue = Number(data.summary.grabRevenue || 0) + Number(data.summary.shopeefoodRevenue || 0) + Number(data.summary.beRevenue || 0) + Number(data.summary.mposRevenue || 0) + Number(data.summary.xanhSmRevenue || 0);
  const shiftReports = {
    morning: data.items.find(item => item.operationShift === "morning"),
    evening: data.items.find(item => item.operationShift === "evening"),
  };
  const paymentRows = report => [
    ["Tiền mặt", report?.cashRevenue], ["Be", report?.beRevenue], ["Grab", report?.grabRevenue],
    ["ShopeeFood", report?.shopeefoodRevenue], ["MPOS", report?.mposRevenue], ["Xanh SM", report?.xanhSmRevenue],
  ];
  const selectedBranch = branches.find(branch => String(branch.id) === String(branchId));
  const visibleBranches = useMemo(() => {
    const key = branchSearch.trim().toLocaleLowerCase("vi");
    return branches.filter(branch => !key || `${branch.branchName} ${branch.branchCode || ""} ${branch.address || ""}`.toLocaleLowerCase("vi").includes(key));
  }, [branches, branchSearch]);
  const branchReports = id => data.items.filter(item => String(item.branchId) === String(id));

  if (!branchId) return <div className="operation-dashboard attendance-branch-overview">
    {error && <div className="manager-form-error">{error}</div>}
    <div className="employee-page-title"><div><h1>Quản lý báo cáo ca</h1><p>Chọn chi nhánh để xem doanh thu và báo cáo ca theo ngày.</p></div><div className="attendance-branch-count"><FiUsers/><b>{branches.length}</b><span>chi nhánh</span></div></div>
    <label className="attendance-branch-search"><FiSearch/><input value={branchSearch} onChange={event=>setBranchSearch(event.target.value)} placeholder="Tìm tên, mã hoặc địa chỉ chi nhánh"/></label>
    <div className="attendance-branch-cards">{visibleBranches.map(branch=>{const reports=branchReports(branch.id),total=reports.reduce((sum,item)=>sum+Number(item.totalRevenue||0),0);return <article className="card" key={branch.id}>
      <header><span className="attendance-branch-icon"><FiGitBranch/></span><div><h2>{branch.branchName}</h2><p>{branch.branchCode||"Chưa có mã chi nhánh"}</p></div><small>{branch.status==="inactive"?"Ngừng hoạt động":"Đang hoạt động"}</small></header>
      <div className="attendance-branch-card-stats"><span><b>{reports.length}</b><small>Ca đã báo cáo</small></span><span><b>{cash(total)}</b><small>Doanh thu ngày</small></span></div>
      <button className="btn btn-primary" onClick={()=>setBranchId(String(branch.id))}>Xem báo cáo →</button>
    </article>})}</div>
  </div>;

  return <div className="operation-dashboard">
    {error && <div className="manager-form-error">{error}</div>}
    <button type="button" className="attendance-back-branches" onClick={()=>setBranchId("")}><FiChevronLeft/> Tất cả chi nhánh</button>
    <span className="attendance-current-branch">{selectedBranch?.branchName||"Chi nhánh"}</span>
    <section className="card operation-dashboard-toolbar"><div><h1>Báo cáo ca</h1><p>Chỉ hiển thị những ca đã kết và gửi báo cáo</p></div><input type="date" value={date} onChange={event => setDate(event.target.value)} /><button className="btn btn-light" onClick={load}><FiRefreshCw /> Tải lại</button><button className="btn btn-yellow" onClick={() => download("excel")}><FiDownload /> Excel</button><button className="btn btn-dark" onClick={() => download("pdf")}><FiDownload /> PDF</button></section>
    <div className="operation-summary">{[["Tổng doanh thu", data.summary.totalRevenue], ["Tiền mặt", data.summary.cashRevenue], ["Doanh thu ứng dụng", appRevenue], ["Chênh lệch quỹ", data.summary.differenceAmount]].map(([label, value]) => <article className="card" key={label}><small>{label}</small><b>{cash(value)}</b></article>)}</div>
    <section className="card operation-daily-breakdown">
      <header><div><small>CHI TIẾT DOANH THU NGÀY</small><h2>{date.split("-").reverse().join("/")}</h2></div><strong>Tổng cả ngày: {cash(data.summary.totalRevenue)}</strong></header>
      <div className="operation-daily-shifts">{[["morning","Ca sáng"],["evening","Ca tối"]].map(([code,label]) => {
        const report=shiftReports[code];
        return <article key={code} className={!report?"empty":""}>
          <div className="operation-daily-shift-title"><span>{label}</span><b>{report?cash(report.totalRevenue):"Chưa có báo cáo"}</b></div>
          {report?<><div className="operation-daily-payments">{paymentRows(report).map(([name,value])=><div key={name}><small>{name}</small><b>{cash(value)}</b></div>)}</div><footer>Người báo cáo: <b>{report.leaderName}</b><button onClick={()=>setSelected(report)}><FiEye/> Xem chi tiết</button></footer></>:<p>Ca này chưa kết ca và gửi báo cáo.</p>}
        </article>;
      })}</div>
    </section>
    {!data.items.length && <section className="card operation-dashboard-empty">Ngày này chưa có ca nào đã kết.</section>}
    <section className="card operation-timeline"><h2>Lịch sử gửi báo cáo</h2>{timeline.map(event => <article key={event.eventId}><FiClock /><div><b>{event.eventType}</b><small>{event.actorName || "Hệ thống"} · {new Date(event.occurredAt).toLocaleString("vi-VN")}</small></div></article>)}</section>
    <DetailModal report={selected} onClose={() => setSelected(null)} />
  </div>;
}
