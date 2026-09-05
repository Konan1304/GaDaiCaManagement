import { useEffect, useMemo, useState } from 'react';
import { shiftInventoryApi } from '../../api/services';
import '../../styles/shift-inventory.css';

const errorText = (error) => error?.response?.data?.message || error?.message || 'Có lỗi xảy ra';
const statusText = { RECEIVING: 'Đang kiểm', IN_PROGRESS: 'Đã nhận kho', WAITING_HANDOVER: 'Đã bàn giao', CLOSED: 'Đã khóa' };
const actionText = { BASELINE_CREATED: 'Khởi tạo tồn đầu kỳ', INVENTORY_RECEIVE_STARTED: 'Bắt đầu kiểm nhận', HANDOVER_RECEIVED: 'Đã nhận kho', DISCREPANCY_REPORTED: 'Báo chênh lệch', INVENTORY_HANDED_OVER: 'Đã kiểm và bàn giao', INVENTORY_IMAGE_ADDED: 'Thêm ảnh', DISCREPANCY_RESOLVED: 'Quản lý xử lý chênh lệch' };

export default function ShiftInventoryAdminPage({ embedded = false }) {
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
  const [date, setDate] = useState('');
  const [shiftView, setShiftView] = useState('morning');

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
  const datedSessions = sessions.filter((item) => item.operationShift !== 'baseline' && (!date || item.businessDate === date));
  const visibleSessions = shiftView === 'handover' ? datedSessions : datedSessions.filter((item) => item.operationShift === shiftView);
  const handoverDays = useMemo(() => Object.values(datedSessions.reduce((result, item) => {
    const key = `${item.branchId}-${item.businessDate}`;
    if (!result[key]) result[key] = { key, branchName: item.branchName, businessDate: item.businessDate, morning: null, evening: null };
    result[key][item.operationShift] = item;
    return result;
  }, {})), [datedSessions]);
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

  return <div className={`si-admin ${embedded ? 'si-admin-embedded' : ''}`}>
    <header className="si-title"><div><h1>Sổ kiểm kho</h1><p>Theo dõi tồn nhận, nhập – xuất, tồn cuối và bàn giao riêng theo ca sáng, ca chiều.</p></div><button className="si-secondary" onClick={() => setShowBaseline(!showBaseline)}>Khởi tạo tồn đầu kỳ</button></header>
    <section className="si-book-filters"><label>Chi nhánh<select value={branch} onChange={(event) => { setSelected(null); setBranch(event.target.value); }}>{options.branches.map((item) => <option key={item.branchId} value={item.branchId}>{item.branchName}</option>)}</select></label><label>Ngày kiểm kho<input type="date" value={date} onChange={(event) => { setSelected(null); setDate(event.target.value); }}/></label><div className="si-shift-switch" role="tablist"><button className={shiftView === 'morning' ? 'active' : ''} onClick={() => setShiftView('morning')}>Ca sáng</button><button className={shiftView === 'evening' ? 'active' : ''} onClick={() => setShiftView('evening')}>Ca chiều</button><button className={shiftView === 'handover' ? 'active' : ''} onClick={() => setShiftView('handover')}>So sánh bàn giao</button></div></section>
    {message && <p className="si-ok">{message}</p>}{error && <p className="si-error">{error}</p>}
    <section className="si-dashboard">{[['Đã nhận kho', dashboard.received], ['Đang kiểm', dashboard.checking], ['Đã bàn giao', dashboard.handed], ['Có tranh chấp', dashboard.disputed], ['Có chênh lệch', dashboard.differences], ['Phiếu nhập liên quan', dashboard.receipts]].map(([label, value]) => <div key={label} className={label.includes('tranh') || label.includes('lệch') ? 'warning' : ''}><small>{label}</small><b>{value}</b></div>)}</section>
    {showBaseline && <section className="si-card"><h2>Khởi tạo tồn đầu kỳ</h2><p>Chỉ dùng một lần khi chi nhánh chưa có phiên bàn giao nào.</p><div className="si-products">{products.map((item) => <label key={item.productId}><span>{item.productName}<small>{item.unitName}</small></span><input type="number" min="0" value={counts[item.productId] ?? item.currentQuantity ?? 0} onChange={(event) => setCounts({ ...counts, [item.productId]: event.target.value })}/></label>)}</div><button className="si-primary" onClick={baseline}>Lưu tồn đầu kỳ</button></section>}
    <section className="si-card"><div className="si-section-title"><div><h2>{shiftView === 'handover' ? 'Đối chiếu bàn giao sáng – chiều' : `Sổ ${shiftView === 'morning' ? 'ca sáng' : 'ca chiều'}`}</h2><p>{date ? `Ngày ${date.split('-').reverse().join('/')}` : 'Tất cả ngày'} · Chọn phiên để xem chi tiết từng nguyên liệu.</p></div><span className="si-count-badge">{shiftView === 'handover' ? handoverDays.length : visibleSessions.length} sổ</span></div>
      {shiftView !== 'handover' ? <div className="si-book-list">{visibleSessions.map((item) => <article key={item.id} className={item.pendingDiscrepancies ? 'has-difference' : ''}><div className="si-book-date"><small>{item.operationShift === 'morning' ? 'CA SÁNG' : 'CA CHIỀU'}</small><b>{item.businessDate.split('-').reverse().join('/')}</b><span>{item.branchName}</span></div><div className="si-book-people"><span>Người nhận<b>{item.receiverName || 'Chưa nhận'}</b></span><span>Người bàn giao<b>{item.closerName || 'Chưa bàn giao'}</b></span></div><div className="si-book-metrics"><span><small>Phiếu nhập</small><b>{item.purchaseReceiptCount || 0}</b></span><span className={item.pendingDiscrepancies ? 'danger' : ''}><small>Chênh lệch</small><b>{item.pendingDiscrepancies || 0}</b></span></div><em className={`si-status ${item.pendingDiscrepancies ? 'danger' : ''}`}>{statusText[item.status] || item.status}</em><button onClick={() => detail(item.id)}>Xem sổ chi tiết</button></article>)}{!visibleSessions.length && <div className="si-book-empty">Chưa có sổ kiểm kho cho ca và ngày đã chọn.</div>}</div>
      : <div className="si-handover-list">{handoverDays.map((day) => <article key={day.key}><header><b>{day.businessDate.split('-').reverse().join('/')}</b><span>{day.branchName}</span></header><div className="si-handover-shifts"><div><small>CA SÁNG</small><b>{day.morning ? statusText[day.morning.status] || day.morning.status : 'Chưa có sổ'}</b><span>Bàn giao: {day.morning?.closerName || '—'}</span>{day.morning && <button onClick={() => detail(day.morning.id)}>Xem ca sáng</button>}</div><i>→</i><div><small>CA CHIỀU</small><b>{day.evening ? statusText[day.evening.status] || day.evening.status : 'Chưa có sổ'}</b><span>Nhận: {day.evening?.receiverName || '—'}</span>{day.evening && <button onClick={() => detail(day.evening.id)}>Xem ca chiều</button>}</div></div><footer className={(day.morning?.pendingDiscrepancies || day.evening?.pendingDiscrepancies) ? 'danger' : ''}>{Number(day.morning?.pendingDiscrepancies || 0) + Number(day.evening?.pendingDiscrepancies || 0)} chênh lệch cần xử lý</footer></article>)}{!handoverDays.length && <div className="si-book-empty">Chưa có dữ liệu bàn giao cho ngày đã chọn.</div>}</div>}
    </section>
    {selected && <section className="si-card si-detail"><div className="si-section-title"><div><h2>Phiên #{selected.id} · {selected.branchName}</h2><p>{String(selected.business_date).slice(0, 10)} · Ca {selected.operation_shift_code === 'morning' ? 'sáng' : 'chiều'}</p></div><button className="si-secondary" onClick={() => setSelected(null)}>Đóng</button></div>
      <div className="si-meta"><div><small>Người giao ca</small><b>{selected.creatorName || '—'}</b></div><div><small>Người nhận</small><b>{selected.receiverName || '—'}</b></div><div><small>Giờ nhận</small><b>{selected.received_at ? new Date(selected.received_at).toLocaleString('vi-VN') : '—'}</b></div><div><small>Giờ bàn giao</small><b>{selected.closed_at ? new Date(selected.closed_at).toLocaleString('vi-VN') : '—'}</b></div></div>
      <div className="si-table"><div className="si-row si-stock-row si-head"><b>Sản phẩm</b><b>ĐVT</b><b>Tồn hệ thống</b><b>Tồn nhân viên đếm</b><b>Chênh lệch</b><b>Ghi chú</b><b>Trạng thái</b></div>{selected.items.map((item) => { const actual = item.closing_actual_quantity ?? item.opening_actual_quantity; const expected = item.systemQuantity ?? item.declared_handover_quantity ?? 0; const diff = actual == null ? Number(item.receiving_difference_quantity || 0) : Number(actual)-Number(expected); return <div className={`si-row si-stock-row ${diff ? 'si-row-danger' : ''}`} key={item.id}><strong>{item.productName}</strong><span>{item.unitName}</span><span>{expected}</span><span>{actual ?? '—'}</span><b className={diff ? 'danger' : ''}>{diff}</b><span>{item.receiving_note || item.closing_note || '—'}</span><span className={`si-pill ${diff ? 'danger' : 'ok'}`}>{diff ? 'Lệch' : 'Khớp'}</span></div>; })}</div>
      <div className="si-detail-grid"><div><h3>Ảnh kiểm kho</h3>{selected.images?.length ? selected.images.map((image) => <p key={image.attachmentId}>📷 {image.originalName}</p>) : <p className="si-muted">Chưa có ảnh.</p>}</div><div><h3>Phiếu nhập liên quan</h3>{selected.purchaseReceipts?.length ? selected.purchaseReceipts.map((receipt) => <p key={receipt.receiptId}><b>{receipt.receiptCode}</b> · {receipt.status}</p>) : <p className="si-muted">Chưa có phiếu nhập.</p>}</div></div>
      <h3>Timeline</h3><div className="si-timeline">{(selected.timeline || []).map((entry) => <div key={entry.id}><time>{new Date(entry.createdAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</time><span><b>{actionText[entry.action] || entry.action}</b><small>{entry.actorName || 'Hệ thống'}</small></span></div>)}</div>
    </section>}
    <section className="si-card"><h2>Chênh lệch và tranh chấp</h2>{!visibleDiscrepancies.length && <p>Không có chênh lệch tại chi nhánh này.</p>}<div className="si-list">{visibleDiscrepancies.map((item) => { const value = resolutions[item.id] || {}; return <article key={item.id} className={item.status === 'PENDING' ? 'si-priority' : ''}><div><b>{item.productName}</b><small>{item.branchName}</small></div><span>Ca trước: <b>{item.declared_quantity}</b> · Kiểm lại: <b>{item.actual_quantity}</b> · Lệch: <b className="danger">{item.difference_quantity}</b></span><em className={`si-status ${item.status === 'PENDING' ? 'danger' : ''}`}>{item.status === 'PENDING' ? 'Chờ quản lý' : 'Đã xử lý'}</em>{item.status === 'PENDING' && <div className="si-resolution"><select value={value.action || ''} onChange={(event) => setResolutions({ ...resolutions, [item.id]: { ...value, action: event.target.value } })}><option value="">Chọn xử lý</option><option value="adjustment_in">Điều chỉnh tăng</option><option value="adjustment_out">Điều chỉnh giảm</option><option value="no_adjustment">Không điều chỉnh</option></select><input placeholder="Lý do bắt buộc" value={value.note || ''} onChange={(event) => setResolutions({ ...resolutions, [item.id]: { ...value, note: event.target.value } })}/><button onClick={() => resolve(item)}>Điều chỉnh kho</button></div>}<small>{item.receiving_note || 'Không có ghi chú từ nhân viên'}</small></article>; })}</div></section>
  </div>;
}
