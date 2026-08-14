import { useEffect, useMemo, useState } from 'react';
import { shiftInventoryApi } from '../../api/services';
import '../../styles/shift-inventory.css';

const errorText = (error) => error?.response?.data?.message || error?.message || 'Có lỗi xảy ra';
const statusText = { RECEIVING: 'Đang kiểm', IN_PROGRESS: 'Đã nhận kho', WAITING_HANDOVER: 'Đã bàn giao', CLOSED: 'Đã khóa' };
const actionText = { BASELINE_CREATED: 'Khởi tạo tồn đầu kỳ', INVENTORY_RECEIVE_STARTED: 'Bắt đầu kiểm nhận', HANDOVER_RECEIVED: 'Đã nhận kho', DISCREPANCY_REPORTED: 'Báo chênh lệch', INVENTORY_HANDED_OVER: 'Đã kiểm và bàn giao', INVENTORY_IMAGE_ADDED: 'Thêm ảnh', DISCREPANCY_RESOLVED: 'Quản lý xử lý chênh lệch' };

export default function ShiftInventoryAdminPage() {
  const [options, setOptions] = useState({ branches: [], products: [] });
  const [branch, setBranch] = useState('');
  const [sessions, setSessions] = useState([]);
  const [discrepancies, setDiscrepancies] = useState([]);
  const [counts, setCounts] = useState({});
  const [resolutions, setResolutions] = useState({});
  const [selected, setSelected] = useState(null);
  const [showBaseline, setShowBaseline] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const load = async () => {
    try {
      setError('');
      const [optionResult, sessionResult, discrepancyResult] = await Promise.all([
        shiftInventoryApi.options(), shiftInventoryApi.sessions(branch ? { branchId: branch } : {}), shiftInventoryApi.discrepancies(),
      ]);
      setOptions(optionResult.data); setSessions(sessionResult.data); setDiscrepancies(discrepancyResult.data);
      if (!branch && optionResult.data.branches[0]) setBranch(String(optionResult.data.branches[0].branchId));
    } catch (loadError) { setError(errorText(loadError)); }
  };
  useEffect(() => { load(); }, [branch]);

  const products = useMemo(() => options.products.filter((item) => !branch || String(item.branchId) === String(branch) || item.branchId == null), [options, branch]);
  const visibleDiscrepancies = discrepancies.filter((item) => !branch || String(item.branch_id) === String(branch));
  const dashboard = useMemo(() => ({
    received: sessions.filter((item) => item.status === 'IN_PROGRESS').length,
    checking: sessions.filter((item) => item.status === 'RECEIVING').length,
    handed: sessions.filter((item) => ['WAITING_HANDOVER', 'CLOSED'].includes(item.status)).length,
    disputed: visibleDiscrepancies.filter((item) => item.status === 'PENDING').length,
    differences: sessions.reduce((sum, item) => sum + Number(item.pendingDiscrepancies || 0), 0),
    receipts: sessions.reduce((sum, item) => sum + Number(item.purchaseReceiptCount || 0), 0),
  }), [sessions, visibleDiscrepancies]);

  const baseline = async () => {
    try { setError(''); const response = await shiftInventoryApi.baseline({ branchId: Number(branch), items: products.map((item) => ({ productId: item.productId, quantity: Number(counts[item.productId] ?? item.currentQuantity ?? 0) })), note: 'Khởi tạo tồn đầu kỳ Sandbox' }); setMessage(response.message); setShowBaseline(false); load(); }
    catch (submitError) { setError(errorText(submitError)); }
  };
  const detail = async (id) => { try { setSelected((await shiftInventoryApi.detail(id)).data); } catch (loadError) { setError(errorText(loadError)); } };
  const resolve = async (item) => {
    const value = resolutions[item.id] || {};
    if (!value.action || !value.note?.trim()) return setError('Chọn cách xử lý và nhập lý do trước khi xác nhận.');
    try { setError(''); const response = await shiftInventoryApi.resolve(item.id, value); setMessage(response.message); await load(); await detail(item.receiving_session_id); }
    catch (submitError) { setError(errorText(submitError)); }
  };

  return <div className="si-admin">
    <header className="si-title"><div><h1>Kiểm kho theo ca</h1><p>Theo dõi nhận kho, bàn giao và chênh lệch theo từng chi nhánh.</p></div><div className="si-toolbar"><select value={branch} onChange={(event) => { setSelected(null); setBranch(event.target.value); }}>{options.branches.map((item) => <option key={item.branchId} value={item.branchId}>{item.branchName}</option>)}</select><button className="si-secondary" onClick={() => setShowBaseline(!showBaseline)}>Khởi tạo tồn đầu kỳ</button></div></header>
    {message && <p className="si-ok">{message}</p>}{error && <p className="si-error">{error}</p>}
    <section className="si-dashboard">{[['Đã nhận kho', dashboard.received], ['Đang kiểm', dashboard.checking], ['Đã bàn giao', dashboard.handed], ['Có tranh chấp', dashboard.disputed], ['Có chênh lệch', dashboard.differences], ['Phiếu nhập liên quan', dashboard.receipts]].map(([label, value]) => <div key={label} className={label.includes('tranh') || label.includes('lệch') ? 'warning' : ''}><small>{label}</small><b>{value}</b></div>)}</section>
    {showBaseline && <section className="si-card"><h2>Khởi tạo tồn đầu kỳ</h2><p>Chỉ dùng một lần khi chi nhánh chưa có phiên bàn giao nào.</p><div className="si-products">{products.map((item) => <label key={item.productId}><span>{item.productName}<small>{item.unitName}</small></span><input type="number" min="0" value={counts[item.productId] ?? item.currentQuantity ?? 0} onChange={(event) => setCounts({ ...counts, [item.productId]: event.target.value })}/></label>)}</div><button className="si-primary" onClick={baseline}>Lưu tồn đầu kỳ</button></section>}
    <section className="si-card"><div className="si-section-title"><div><h2>Phiên kiểm kho</h2><p>Chọn một phiên để xem đầy đủ người giao, người nhận, phiếu nhập, ảnh và timeline.</p></div></div><div className="si-list">{sessions.filter((item) => item.operationShift !== 'baseline').map((item) => <article key={item.id} className={item.pendingDiscrepancies ? 'si-priority' : ''}><div><b>{item.businessDate} · Ca {item.operationShift === 'morning' ? 'sáng' : 'chiều'}</b><small>{item.branchName}</small></div><span>Nhận: <b>{item.receiverName || 'Chưa nhận'}</b><br/>Bàn giao: <b>{item.closerName || 'Chưa bàn giao'}</b></span><em className={`si-status ${item.pendingDiscrepancies ? 'danger' : ''}`}>{statusText[item.status] || item.status}</em><button onClick={() => detail(item.id)}>Xem chi tiết</button><small>{item.purchaseReceiptCount || 0} phiếu nhập · {item.pendingDiscrepancies || 0} chênh lệch cần xử lý</small></article>)}</div></section>
    {selected && <section className="si-card si-detail"><div className="si-section-title"><div><h2>Phiên #{selected.id} · {selected.branchName}</h2><p>{String(selected.business_date).slice(0, 10)} · Ca {selected.operation_shift_code === 'morning' ? 'sáng' : 'chiều'}</p></div><button className="si-secondary" onClick={() => setSelected(null)}>Đóng</button></div>
      <div className="si-meta"><div><small>Người giao ca</small><b>{selected.creatorName || '—'}</b></div><div><small>Người nhận</small><b>{selected.receiverName || '—'}</b></div><div><small>Giờ nhận</small><b>{selected.received_at ? new Date(selected.received_at).toLocaleString('vi-VN') : '—'}</b></div><div><small>Giờ bàn giao</small><b>{selected.closed_at ? new Date(selected.closed_at).toLocaleString('vi-VN') : '—'}</b></div></div>
      <div className="si-table"><div className="si-row si-head"><b>Sản phẩm</b><b>ĐVT</b><b>Ca trước</b><b>Tồn đầu</b><b>Nhập</b><b>Xuất</b><b>Tồn cuối</b><b>Chênh lệch nhận</b><b>Ghi chú</b><b>Trạng thái</b></div>{selected.items.map((item) => { const diff = Number(item.receiving_difference_quantity || 0); return <div className={`si-row ${diff ? 'si-row-danger' : ''}`} key={item.id}><strong>{item.productName}</strong><span>{item.unitName}</span><span>{item.declared_handover_quantity ?? '—'}</span><span>{item.opening_actual_quantity ?? '—'}</span><span>+{item.imported_quantity_in_shift || 0}</span><span>-{item.special_export_quantity_in_shift || 0}</span><span>{item.closing_actual_quantity ?? '—'}</span><b className={diff ? 'danger' : ''}>{diff}</b><span>{item.receiving_note || item.closing_note || '—'}</span><span className={`si-pill ${diff ? 'danger' : 'ok'}`}>{diff ? 'Lệch' : 'Khớp'}</span></div>; })}</div>
      <div className="si-detail-grid"><div><h3>Ảnh kiểm kho</h3>{selected.images?.length ? selected.images.map((image) => <p key={image.attachmentId}>📷 {image.originalName}</p>) : <p className="si-muted">Chưa có ảnh.</p>}</div><div><h3>Phiếu nhập liên quan</h3>{selected.purchaseReceipts?.length ? selected.purchaseReceipts.map((receipt) => <p key={receipt.receiptId}><b>{receipt.receiptCode}</b> · {receipt.status}</p>) : <p className="si-muted">Chưa có phiếu nhập.</p>}</div></div>
      <h3>Timeline</h3><div className="si-timeline">{(selected.timeline || []).map((entry) => <div key={entry.id}><time>{new Date(entry.createdAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</time><span><b>{actionText[entry.action] || entry.action}</b><small>{entry.actorName || 'Hệ thống'}</small></span></div>)}</div>
    </section>}
    <section className="si-card"><h2>Chênh lệch và tranh chấp</h2>{!visibleDiscrepancies.length && <p>Không có chênh lệch tại chi nhánh này.</p>}<div className="si-list">{visibleDiscrepancies.map((item) => { const value = resolutions[item.id] || {}; return <article key={item.id} className={item.status === 'PENDING' ? 'si-priority' : ''}><div><b>{item.productName}</b><small>{item.branchName}</small></div><span>Ca trước: <b>{item.declared_quantity}</b> · Kiểm lại: <b>{item.actual_quantity}</b> · Lệch: <b className="danger">{item.difference_quantity}</b></span><em className={`si-status ${item.status === 'PENDING' ? 'danger' : ''}`}>{item.status === 'PENDING' ? 'Chờ quản lý' : 'Đã xử lý'}</em>{item.status === 'PENDING' && <div className="si-resolution"><select value={value.action || ''} onChange={(event) => setResolutions({ ...resolutions, [item.id]: { ...value, action: event.target.value } })}><option value="">Chọn xử lý</option><option value="adjustment_in">Điều chỉnh tăng</option><option value="adjustment_out">Điều chỉnh giảm</option><option value="no_adjustment">Không điều chỉnh</option></select><input placeholder="Lý do bắt buộc" value={value.note || ''} onChange={(event) => setResolutions({ ...resolutions, [item.id]: { ...value, note: event.target.value } })}/><button onClick={() => resolve(item)}>Điều chỉnh kho</button></div>}<small>{item.receiving_note || 'Không có ghi chú từ nhân viên'}</small></article>; })}</div></section>
  </div>;
}
