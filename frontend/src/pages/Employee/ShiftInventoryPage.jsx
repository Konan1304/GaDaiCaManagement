import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { shiftInventoryApi } from '../../api/services';
import '../../styles/shift-inventory.css';

const errorText = (error) => error?.response?.data?.message || error?.message || 'Không thể tải dữ liệu kiểm kho';
const number = (value) => Number(value || 0);
const quantity = (value) => Number.isInteger(number(value)) ? number(value) : number(value).toFixed(3);
const statusText = { RECEIVING: 'Đang kiểm nhận', IN_PROGRESS: 'Đã nhận kho', WAITING_HANDOVER: 'Đã bàn giao', CLOSED: 'Đã khóa' };
const actionText = {
  INVENTORY_RECEIVE_STARTED: 'Bắt đầu kiểm nhận kho', HANDOVER_RECEIVED: 'Xác nhận nhận kho',
  DISCREPANCY_REPORTED: 'Báo chênh lệch', INVENTORY_HANDED_OVER: 'Kiểm kho và bàn giao',
  INVENTORY_IMAGE_ADDED: 'Thêm ảnh kiểm kho', SHIFT_LINKED: 'Liên kết ca vận hành',
};

export default function ShiftInventoryPage() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [form, setForm] = useState({});
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = async () => {
    try {
      setError('');
      const response = await shiftInventoryApi.current();
      const inventory = response.data?.inventory;
      setData(response.data);
      setForm(Object.fromEntries((inventory?.items || []).map((item) => [item.product_id, {
        quantity: inventory.status === 'RECEIVING' ? (item.opening_actual_quantity ?? '') : (item.closing_actual_quantity ?? ''),
        note: item.receiving_note || item.closing_note || '',
      }])));
    } catch (loadError) { setError(errorText(loadError)); }
  };
  useEffect(() => { load(); }, []);

  const inventory = data?.inventory;
  const operation = data?.operation;
  const items = inventory?.items || [];
  const readOnly = ['WAITING_HANDOVER', 'CLOSED'].includes(inventory?.status);
  const canUpload = Boolean(inventory?.shift_session_id) && !readOnly;
  const summary = useMemo(() => ({
    mismatches: items.filter((item) => number(item.receiving_difference_quantity) !== 0).length,
    imported: items.reduce((sum, item) => sum + number(item.imported_quantity_in_shift), 0),
    exported: items.reduce((sum, item) => sum + number(item.special_export_quantity_in_shift), 0),
  }), [items]);

  const run = async (callback) => {
    try { setBusy(true); setError(''); const response = await callback(); setMessage(response.message || 'Đã lưu'); await load(); }
    catch (submitError) { setError(errorText(submitError)); }
    finally { setBusy(false); }
  };
  const submit = (kind) => run(() => {
    const payload = items.map((item) => ({
      productId: item.product_id,
      ...(kind === 'receive' ? { actualQuantity: form[item.product_id]?.quantity } : { closingQuantity: form[item.product_id]?.quantity }),
      note: form[item.product_id]?.note || '',
    }));
    return kind === 'receive' ? shiftInventoryApi.receive(inventory.id, payload) : shiftInventoryApi.close(inventory.id, { items: payload, note: '' });
  });
  const upload = (file) => file && run(() => shiftInventoryApi.uploadImage(inventory.id, file));

  if (!data && !error) return <div className="si-page"><div className="si-empty"><h2>Đang tải kiểm kho…</h2></div></div>;
  if (!operation) return <div className="si-page"><div className="si-empty"><h2>Chưa đủ điều kiện kiểm nhận kho</h2><p>Bạn cần có lịch chính thức và đã chấm công vào ca.</p>{error && <p className="si-error">{error}</p>}</div></div>;
  if (!inventory) return <div className="si-page">
    <section className="si-hero"><span className="si-badge">BƯỚC 1</span><h2>Nhận kho đầu ca</h2><p>{operation.businessDate} · Ca {operation.operationShift === 'morning' ? 'sáng' : 'chiều'}</p></section>
    {error && <p className="si-error">{error}</p>}
    <section className="si-card si-onboarding"><h3>Kiểm số ca trước trước khi mở ca</h3><p>Hệ thống sẽ lấy đúng số tồn mà ca trước đã bàn giao. Bạn chỉ nhập số tự đếm, không thể sửa số của ca trước.</p><button disabled={busy} className="si-primary" onClick={() => run(() => shiftInventoryApi.start({ scheduleId: operation.scheduleId, businessDate: operation.businessDate }))}>Bắt đầu kiểm nhận kho</button></section>
  </div>;

  return <div className="si-page">
    <section className="si-hero"><span className="si-badge">{statusText[inventory.status] || inventory.status}</span><h2>Kiểm kho ca {inventory.operation_shift_code === 'morning' ? 'sáng' : 'chiều'}</h2><p>{inventory.business_date?.slice?.(0, 10) || operation.businessDate} · {inventory.branchName}</p></section>
    {message && <p className="si-ok">{message}</p>}{error && <p className="si-error">{error}</p>}
    <div className="si-summary"><div><small>Sản phẩm</small><b>{items.length}</b></div><div><small>Chênh lệch nhận</small><b className={summary.mismatches ? 'danger' : ''}>{summary.mismatches}</b></div><div><small>Nhập trong ca</small><b>+{quantity(summary.imported)}</b></div><div><small>Xuất trong ca</small><b>-{quantity(summary.exported)}</b></div></div>
    {inventory.status === 'IN_PROGRESS' && <p className="si-ok">Đã nhận kho. Bạn có thể mở ca và tiếp tục làm việc.</p>}
    <section className="si-card"><h3>{inventory.status === 'RECEIVING' ? 'Đối chiếu bàn giao đầu ca' : readOnly ? 'Phiên kho đã bàn giao' : 'Kiểm kho cuối ca'}</h3>
      <div className="si-table"><div className="si-row si-head"><b>Sản phẩm</b><b>ĐVT</b><b>Ca trước</b><b>Nhập</b><b>Xuất</b><b>Tồn dự kiến</b><b>Tồn thực tế</b><b>Chênh lệch</b><b>Ghi chú</b><b>Trạng thái</b></div>
        {items.map((item) => {
          const opening = inventory.status === 'RECEIVING' ? number(item.declared_handover_quantity) : number(item.opening_actual_quantity);
          const expected = opening + number(item.imported_quantity_in_shift) - number(item.special_export_quantity_in_shift);
          const actual = form[item.product_id]?.quantity;
          const diff = actual === '' || actual == null ? null : number(actual) - expected;
          const savedDiff = inventory.status === 'RECEIVING' ? item.receiving_difference_quantity : (item.closing_actual_quantity == null ? null : number(item.closing_actual_quantity) - expected);
          const shownDiff = readOnly ? savedDiff : diff;
          const state = shownDiff == null ? 'Chưa kiểm' : number(shownDiff) === 0 ? 'Khớp' : 'Lệch';
          return <div className={`si-row ${state === 'Lệch' ? 'si-row-danger' : ''}`} key={item.id}>
            <strong>{item.productName}<small>{item.productCode}</small></strong><span>{item.unitName}</span><span>{quantity(opening)}</span><span>+{quantity(item.imported_quantity_in_shift)}</span><span>-{quantity(item.special_export_quantity_in_shift)}</span><span>{quantity(expected)}</span>
            {readOnly ? <span>{quantity(item.closing_actual_quantity ?? item.opening_actual_quantity)}</span> : <input type="number" min="0" step="0.001" value={actual ?? ''} onChange={(event) => setForm({ ...form, [item.product_id]: { ...form[item.product_id], quantity: event.target.value } })}/>}<b className={state === 'Lệch' ? 'danger' : ''}>{shownDiff == null ? '—' : quantity(shownDiff)}</b>
            {readOnly ? <span>{item.receiving_note || item.closing_note || '—'}</span> : <input value={form[item.product_id]?.note || ''} placeholder={state === 'Lệch' ? 'Bắt buộc ghi lý do' : 'Ghi chú'} onChange={(event) => setForm({ ...form, [item.product_id]: { ...form[item.product_id], note: event.target.value } })}/>}<span className={`si-pill ${state === 'Lệch' ? 'danger' : state === 'Khớp' ? 'ok' : ''}`}>{state}</span>
          </div>;
        })}
      </div>
      {!readOnly && <div className="si-actions"><button disabled={busy} className="si-primary" onClick={() => submit(inventory.status === 'RECEIVING' ? 'receive' : 'close')}>{inventory.status === 'RECEIVING' ? 'Xác nhận nhận kho' : 'Kiểm kho và bàn giao'}</button>{inventory.status === 'IN_PROGRESS' && <button className="si-secondary" onClick={() => navigate('/employee/shift')}>Đến mở/kết ca</button>}</div>}
    </section>
    <section className="si-card"><h3>Ảnh kiểm kho ({inventory.images?.length || 0}/10)</h3>{canUpload && <label className="si-upload">Thêm ảnh<input type="file" accept="image/*" multiple onChange={async (event) => { for (const file of event.target.files) await upload(file); event.target.value = ''; }}/></label>}<div className="si-image-list">{(inventory.images || []).map((image) => <span key={image.attachmentId}>📷 {image.originalName}</span>)}</div>{!inventory.shift_session_id && <p className="si-muted">Mở ca xong mới có thể tải ảnh; ảnh vẫn được lưu vào đúng phiên kiểm kho này.</p>}</section>
    <section className="si-card"><h3>Timeline trong ca</h3><div className="si-timeline">{(inventory.timeline || []).map((entry) => <div key={entry.id}><time>{new Date(entry.createdAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</time><span><b>{actionText[entry.action] || entry.action}</b><small>{entry.actorName || 'Hệ thống'}</small></span></div>)}{(inventory.purchaseReceipts || []).map((receipt) => <div key={`receipt-${receipt.receiptId}`}><time>{new Date(receipt.createdAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</time><span><b>Nhập hàng · {receipt.receiptCode}</b><small>{receipt.status}</small></span></div>)}</div></section>
  </div>;
}
