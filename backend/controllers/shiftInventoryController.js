const fs = require('fs');
const path = require('path');
const sql = require('mssql/msnodesqlv8');
const { getPool } = require('../config/db');
const { businessNow } = require('../services/businessClockService');
const { employeeFromJwt } = require('../services/shiftEligibilityService');
const upload = require('../middleware/operationUpload');

const fail = (res, status, message) => res.status(status).json({ success: false, message });
const transactional = (transaction) => ({ request: () => new sql.Request(transaction) });
const numberValue = (value) => (Number.isFinite(Number(value)) ? Number(value) : null);
const isTestEnv = () => (process.env.APP_ENV === 'sandbox' ? 1 : 0);

async function guard(db) {
  // Hoạt động trên cả Production và Sandbox
  return true;
}

async function audit(db, entry) {
  const isTest = isTestEnv();
  await db.request()
    .input('sessionId', sql.BigInt, entry.sessionId || null)
    .input('discrepancyId', sql.BigInt, entry.discrepancyId || null)
    .input('branchId', sql.Int, entry.branchId)
    .input('userId', sql.Int, entry.userId)
    .input('action', sql.VarChar(60), entry.action)
    .input('payload', sql.NVarChar(sql.MAX), JSON.stringify(entry.payload || {}))
    .input('isTest', sql.Bit, isTest)
    .query(`INSERT shift_inventory_audit_logs
      (inventory_session_id,discrepancy_id,branch_id,actor_user_id,action,payload_json,is_test)
      VALUES(@sessionId,@discrepancyId,@branchId,@userId,@action,@payload,@isTest)`);
}

async function load(db, id) {
  const isTest = isTestEnv();
  const result = await db.request().input('id', sql.BigInt, id).input('isTest', sql.Bit, isTest).query(`
    SELECT s.*,b.branch_name branchName,ru.full_name receiverName,cu.full_name closerName,ou.full_name creatorName
    FROM shift_inventory_sessions s
    JOIN branches b ON b.id=s.branch_id
    LEFT JOIN employees re ON re.id=s.received_by_employee_id LEFT JOIN users ru ON ru.id=re.user_id
    LEFT JOIN employees ce ON ce.id=s.closed_by_employee_id LEFT JOIN users cu ON cu.id=ce.user_id
    LEFT JOIN users ou ON ou.id=s.created_by_user_id
    WHERE s.id=@id AND s.is_test=@isTest;

    SELECT i.*,p.product_code productCode,p.product_name productName,c.category_name categoryName,u.unit_name unitName,
      COALESCE(m.importedQuantity,0) liveImportedQuantity,
      COALESCE(m.exportedQuantity,0) liveExportedQuantity,
      COALESCE(bi.quantity,0) systemQuantity
    FROM shift_inventory_items i
    JOIN shift_inventory_sessions sis ON sis.id=i.session_id
    JOIN products p ON p.id=i.product_id JOIN categories c ON c.id=p.category_id JOIN units u ON u.id=i.unit_id
    LEFT JOIN branch_inventories bi ON bi.branch_id=sis.branch_id AND bi.product_id=i.product_id
    OUTER APPLY (SELECT
      COALESCE(SUM(CASE WHEN t.transaction_type IN('import','transfer_in','adjustment_in') THEN t.quantity ELSE 0 END),0) importedQuantity,
      COALESCE(SUM(CASE WHEN t.transaction_type IN('sale','waste','transfer_out','adjustment_out') THEN t.quantity ELSE 0 END),0) exportedQuantity
      FROM inventory_transactions t
      WHERE t.branch_id=sis.branch_id AND t.product_id=i.product_id
        AND t.created_at>=COALESCE(sis.received_at,sis.created_at)
        AND t.created_at<=COALESCE(sis.closed_at,SYSDATETIME())) m
    WHERE i.session_id=@id AND p.status='active' ORDER BY c.category_name,p.product_name;

    SELECT d.*,p.product_name productName
    FROM inventory_discrepancies d JOIN products p ON p.id=d.product_id
    WHERE d.receiving_session_id=@id ORDER BY d.id;

    SELECT l.id,l.action,l.payload_json payloadJson,l.created_at createdAt,u.full_name actorName
    FROM shift_inventory_audit_logs l LEFT JOIN users u ON u.id=l.actor_user_id
    WHERE l.inventory_session_id=@id ORDER BY l.id;

    SELECT a.id attachmentId,a.original_name originalName,a.mime_type mimeType,a.file_size fileSize,a.created_at createdAt
    FROM operation_attachments a JOIN shift_inventory_sessions s ON s.shift_session_id=a.shift_session_id
    WHERE s.id=@id AND a.attachment_type='other' AND a.is_deleted=0 AND a.is_test=@isTest
      AND EXISTS(SELECT 1 FROM shift_inventory_audit_logs al WHERE al.inventory_session_id=s.id
        AND al.action='INVENTORY_IMAGE_ADDED' AND TRY_CONVERT(BIGINT,JSON_VALUE(al.payload_json,'$.attachmentId'))=a.id)
    ORDER BY a.id;

    SELECT pr.id receiptId,pr.receipt_code receiptCode,pr.receipt_date receiptDate,pr.status,
      pr.total_amount totalAmount,pr.created_at createdAt
    FROM purchase_receipts pr JOIN shift_inventory_sessions s ON s.branch_id=pr.branch_id
    WHERE s.id=@id AND pr.created_at>=COALESCE(s.received_at,s.created_at)
      AND pr.created_at<=COALESCE(s.closed_at,SYSDATETIME()) ORDER BY pr.created_at;
  `);
  if (!result.recordsets[0][0]) return null;
  return { ...result.recordsets[0][0], items: result.recordsets[1], discrepancies: result.recordsets[2], timeline: result.recordsets[3], images: result.recordsets[4], purchaseReceipts: result.recordsets[5] };
}

async function employeeContext(db, userId, date, selectedScheduleId = null) {
  const isTest = isTestEnv();
  const employee = await employeeFromJwt(db, userId);
  if (!employee) return null;
  const scheduleId = Number.isInteger(Number(selectedScheduleId)) && Number(selectedScheduleId) > 0 ? Number(selectedScheduleId) : null;
  const result = await db.request().input('employeeId', sql.Int, employee.employeeId).input('branchId', sql.Int, employee.branchId).input('date', sql.Date, date).input('scheduleId', sql.Int, scheduleId).input('isTest', sql.Bit, isTest).query(`
    SELECT TOP 1 es.id scheduleId,es.branch_id branchId,CONVERT(char(10),es.work_date,23) businessDate,
      s.shift_code shiftCode,CONVERT(char(5),COALESCE(es.start_time_override,s.start_time),108) startTime,
      CONVERT(char(5),COALESCE(es.end_time_override,s.end_time),108) endTime,
      CASE WHEN UPPER(REPLACE(REPLACE(COALESCE(es.display_code,s.shift_code),' ',''),'+','')) LIKE '%FULL%'
        OR UPPER(COALESCE(es.display_code,s.shift_code)) IN('AB','BA') OR s.shift_code IN('A','P1','P2')
        THEN 'morning' ELSE 'evening' END operationShift
    FROM employee_schedules es JOIN shifts s ON s.id=es.shift_id
    WHERE es.employee_id=@employeeId AND es.branch_id=@branchId AND es.work_date=@date AND (es.is_test=@isTest OR (es.is_test=0 AND @isTest=1))
      AND (@scheduleId IS NULL OR es.id=@scheduleId)
      AND es.status<>'cancelled'
      AND EXISTS(SELECT 1 FROM schedule_registration_periods rp WHERE rp.branch_id=es.branch_id
        AND rp.status='published' AND (rp.is_test=@isTest OR (rp.is_test=0 AND @isTest=1)) AND es.work_date BETWEEN rp.week_start_date AND rp.week_end_date)
      AND EXISTS(SELECT 1 FROM attendance_logs a WHERE a.schedule_id=es.id AND a.employee_id=@employeeId
        AND a.check_in_time IS NOT NULL AND a.status<>'absent' AND (a.is_test=@isTest OR (a.is_test=0 AND @isTest=1)))
    ORDER BY COALESCE(es.start_time_override,s.start_time)`);
  return { ...employee, schedule: result.recordset[0] || null };
}

async function options(req, res, next) {
  try {
    const pool = await getPool(); await guard(pool);
    const result = await pool.request().query(`
      SELECT id branchId,branch_code branchCode,branch_name branchName FROM branches WHERE status='active' ORDER BY branch_name;
      SELECT p.id productId,p.product_code productCode,p.product_name productName,p.unit_id unitId,u.unit_name unitName,
        bi.branch_id branchId,COALESCE(bi.quantity,0) currentQuantity
      FROM products p JOIN units u ON u.id=p.unit_id LEFT JOIN branch_inventories bi ON bi.product_id=p.id
      WHERE p.status='active' ORDER BY p.product_name`);
    res.json({ success: true, data: { branches: result.recordsets[0], products: result.recordsets[1] } });
  } catch (error) { next(error); }
}

async function baseline(req, res, next) {
  const isTest = isTestEnv();
  const pool = await getPool(); const tx = new sql.Transaction(pool); let begun = false;
  try {
    const branchId = Number(req.body.branchId); const items = req.body.items;
    if (!Number.isInteger(branchId) || !Array.isArray(items) || !items.length) return fail(res, 400, 'Dữ liệu tồn đầu kỳ không hợp lệ');
    await tx.begin(); begun = true; const db = transactional(tx); await guard(db);
    const created = await db.request().input('branchId', sql.Int, branchId).input('userId', sql.Int, req.user.userId).input('note', sql.NVarChar(1000), req.body.note || null).input('isTest', sql.Bit, isTest).query(`
      UPDATE shift_inventory_sessions SET status='CLOSED',updated_at=SYSDATETIME()
      WHERE branch_id=@branchId AND operation_shift_code='baseline' AND status='WAITING_HANDOVER' AND is_test=@isTest;
      INSERT shift_inventory_sessions(branch_id,business_date,operation_shift_code,status,created_by_user_id,note,is_test,received_at,closed_at)
      OUTPUT INSERTED.id VALUES(@branchId,CAST(SYSDATETIME() AS date),'baseline','WAITING_HANDOVER',@userId,@note,@isTest,SYSDATETIME(),SYSDATETIME())`);
    const sessionId = created.recordset[0].id;
    for (const item of items) {
      const product = (await db.request().input('productId', sql.Int, Number(item.productId)).query("SELECT id,unit_id FROM products WHERE id=@productId AND status='active'")).recordset[0];
      const quantity = numberValue(item.quantity);
      if (!product || quantity === null || quantity < 0) throw Object.assign(new Error('Số lượng không hợp lệ'), { http: 400 });
      await db.request().input('sessionId', sql.BigInt, sessionId).input('productId', sql.Int, product.id).input('unitId', sql.Int, product.unit_id).input('quantity', sql.Decimal(18, 3), quantity).input('branchId', sql.Int, branchId).query(`
        INSERT shift_inventory_items(session_id,product_id,unit_id,opening_actual_quantity,actual_received_quantity,closing_actual_quantity,estimated_used_quantity)
        VALUES(@sessionId,@productId,@unitId,@quantity,@quantity,@quantity,0);
        MERGE branch_inventories t USING(SELECT @branchId branch_id,@productId product_id)s
        ON t.branch_id=s.branch_id AND t.product_id=s.product_id
        WHEN MATCHED THEN UPDATE SET quantity=@quantity,updated_at=SYSDATETIME()
        WHEN NOT MATCHED THEN INSERT(branch_id,product_id,quantity,average_cost)VALUES(@branchId,@productId,@quantity,0);`);
    }
    await audit(db, { sessionId, branchId, userId: req.user.userId, action: 'BASELINE_CREATED', payload: { items: items.length } });
    await tx.commit(); begun = false;
    res.status(201).json({ success: true, message: 'Đã khởi tạo tồn đầu kỳ', data: { sessionId } });
  } catch (error) { if (begun) await tx.rollback().catch(() => {}); error.http ? fail(res, error.http, error.message) : next(error); }
}

async function current(req, res, next) {
  try {
    const isTest = isTestEnv();
    const pool = await getPool(); await guard(pool); const clock = await businessNow(pool);
    const date = /^\d{4}-\d{2}-\d{2}$/.test(req.query.date || '') ? req.query.date : clock.businessDate;
    const context = await employeeContext(pool, req.user.userId, date, process.env.APP_ENV === 'sandbox' ? req.query.scheduleId : null);
    if (!context) return fail(res, 404, 'Không tìm thấy nhân viên');
    const active = (await pool.request().input('branchId', sql.Int, context.branchId).input('date', sql.Date, date).input('userId', sql.Int, req.user.userId).input('isTest', sql.Bit, isTest).query(`
      SELECT TOP 1 id FROM shift_inventory_sessions WHERE branch_id=@branchId AND business_date=@date
        AND created_by_user_id=@userId AND is_test=@isTest AND status IN('RECEIVING','IN_PROGRESS','WAITING_HANDOVER') ORDER BY id DESC`)).recordset[0];
    if(active)await pool.request().input('sessionId',sql.BigInt,active.id).input('branchId',sql.Int,context.branchId).query(`INSERT shift_inventory_items(session_id,product_id,unit_id,declared_handover_quantity,opening_actual_quantity,actual_received_quantity)
      SELECT @sessionId,p.id,p.unit_id,COALESCE(bi.quantity,0),COALESCE(bi.quantity,0),COALESCE(bi.quantity,0)
      FROM products p LEFT JOIN branch_inventories bi ON bi.branch_id=@branchId AND bi.product_id=p.id
      WHERE p.status='active' AND NOT EXISTS(SELECT 1 FROM shift_inventory_items i WHERE i.session_id=@sessionId AND i.product_id=p.id)`);
    res.json({ success: true, data: { employee: context, operation: context.schedule ? { ...context.schedule, shiftStatus: 'PRE_OPEN' } : null, inventory: active ? await load(pool, active.id) : null } });
  } catch (error) { next(error); }
}

async function start(req, res, next) {
  const isTest = isTestEnv();
  const pool = await getPool(); const tx = new sql.Transaction(pool); let begun = false;
  try {
    await tx.begin(); begun = true; const db = transactional(tx); await guard(db); const clock = await businessNow(db);
    const date = /^\d{4}-\d{2}-\d{2}$/.test(req.body.businessDate || '') ? req.body.businessDate : clock.businessDate;
    const scheduleId = Number(req.body.scheduleId); const context = await employeeContext(db, req.user.userId, date, process.env.APP_ENV === 'sandbox' ? scheduleId : null);
    if (!context?.schedule || Number(context.schedule.scheduleId) !== scheduleId) throw Object.assign(new Error('Cần đúng lịch đã công bố và đã chấm công vào'), { http: 403 });
    const active = (await db.request().input('branchId', sql.Int, context.branchId).input('date', sql.Date, date).input('operation', sql.VarChar(10), context.schedule.operationShift).input('isTest', sql.Bit, isTest).query(`
      SELECT TOP 1 id,created_by_user_id FROM shift_inventory_sessions WITH(UPDLOCK,HOLDLOCK)
      WHERE branch_id=@branchId AND business_date=@date AND operation_shift_code=@operation
        AND status IN('RECEIVING','IN_PROGRESS') AND is_test=@isTest`)).recordset[0];
    if (active) throw Object.assign(new Error(active.created_by_user_id === req.user.userId ? 'Bạn đã bắt đầu nhận kho' : 'Một nhân viên khác đang nhận kho ca này'), { http: 409 });
    const previous = (await db.request().input('branchId', sql.Int, context.branchId).input('isTest', sql.Bit, isTest).query(`SELECT TOP 1 id FROM shift_inventory_sessions WITH(UPDLOCK)
      WHERE branch_id=@branchId AND status='WAITING_HANDOVER' AND is_test=@isTest ORDER BY closed_at DESC,id DESC`)).recordset[0];
    const created = await db.request().input('branchId', sql.Int, context.branchId).input('previousId', sql.BigInt, previous?.id||null).input('date', sql.Date, date).input('operation', sql.VarChar(10), context.schedule.operationShift).input('userId', sql.Int, req.user.userId).input('isTest', sql.Bit, isTest).query(`
      INSERT shift_inventory_sessions(branch_id,previous_inventory_session_id,business_date,operation_shift_code,status,created_by_user_id,is_test,received_at)
      OUTPUT INSERTED.id VALUES(@branchId,@previousId,@date,@operation,'IN_PROGRESS',@userId,@isTest,SYSDATETIME())`);
    const sessionId = created.recordset[0].id;
    await db.request().input('sessionId', sql.BigInt, sessionId).input('branchId', sql.Int, context.branchId).query(`INSERT shift_inventory_items(session_id,product_id,unit_id,declared_handover_quantity)
      SELECT @sessionId,p.id,p.unit_id,COALESCE(bi.quantity,0)
      FROM products p LEFT JOIN branch_inventories bi ON bi.branch_id=@branchId AND bi.product_id=p.id
      WHERE p.status='active'`);
    await audit(db, { sessionId, branchId: context.branchId, userId: req.user.userId, action: 'SHIFT_USAGE_STARTED', payload: { scheduleId } });
    await tx.commit(); begun = false;
    res.status(201).json({ success: true, message: 'Đã mở sổ xuất nguyên liệu trong ca', data: await load(pool, sessionId) });
  } catch (error) { if (begun) await tx.rollback().catch(() => {}); error.http ? fail(res, error.http, error.message) : next(error); }
}

async function receive(req, res, next) {
  const isTest = isTestEnv();
  const pool = await getPool(); const tx = new sql.Transaction(pool); let begun = false;
  try {
    await tx.begin(); begun = true; const db = transactional(tx); await guard(db);
    const employee = await employeeFromJwt(db, req.user.userId); const sessionId = Number(req.params.id); const items = req.body.items || [];
    const session = (await db.request().input('sessionId', sql.BigInt, sessionId).input('userId', sql.Int, req.user.userId).input('isTest', sql.Bit, isTest).query("SELECT * FROM shift_inventory_sessions WITH(UPDLOCK) WHERE id=@sessionId AND created_by_user_id=@userId AND status='RECEIVING' AND is_test=@isTest")).recordset[0];
    if (!session) throw Object.assign(new Error('Không có quyền nhận phiên kho này'), { http: 403 });
    await db.request().input('sessionId', sql.BigInt, sessionId).input('employeeId', sql.Int, employee.employeeId).query("UPDATE shift_inventory_sessions SET received_by_employee_id=@employeeId,received_at=SYSDATETIME(),updated_at=SYSDATETIME() WHERE id=@sessionId");
    for (const item of items) {
      const row = (await db.request().input('sessionId', sql.BigInt, sessionId).input('productId', sql.Int, Number(item.productId)).query('SELECT * FROM shift_inventory_items WITH(UPDLOCK) WHERE session_id=@sessionId AND product_id=@productId')).recordset[0];
      const actual = numberValue(item.actualQuantity); const imported = 0; const exported = 0; const note = String(item.note || '').trim();
      if (!row || actual === null || actual < 0) throw Object.assign(new Error('Số tồn thực tế không hợp lệ'), { http: 400 });
      const expected = Number(row.declared_handover_quantity);
      const difference = actual - expected;
      if (difference && !note) throw Object.assign(new Error('Có chênh lệch phải nhập ghi chú'), { http: 400 });
      if (false && imported > 0) {
        const reason = `Nhập tay khi nhận kho đầu ca${note ? `: ${note}` : ''}`;
        await db.request().input('branchId', sql.Int, session.branch_id).input('productId', sql.Int, row.product_id).input('quantity', sql.Decimal(18, 3), imported).input('referenceId', sql.Int, sessionId).input('reason', sql.NVarChar(500), reason).input('userId', sql.Int, req.user.userId).query(`
          MERGE branch_inventories AS target USING(SELECT @branchId branch_id,@productId product_id) AS source
          ON target.branch_id=source.branch_id AND target.product_id=source.product_id
          WHEN MATCHED THEN UPDATE SET quantity=target.quantity+@quantity,updated_at=SYSDATETIME()
          WHEN NOT MATCHED THEN INSERT(branch_id,product_id,quantity,average_cost) VALUES(@branchId,@productId,@quantity,0);
          INSERT inventory_transactions(branch_id,product_id,transaction_type,quantity,reference_type,reference_id,reason,created_by,created_at)
          VALUES(@branchId,@productId,'transfer_in',@quantity,'shift_inventory_receive',@referenceId,@reason,@userId,SYSDATETIME())`);
      }
      if (false && exported > 0) {
        const stock = (await db.request().input('branchId', sql.Int, session.branch_id).input('productId', sql.Int, row.product_id).query('SELECT quantity FROM branch_inventories WITH(UPDLOCK,HOLDLOCK) WHERE branch_id=@branchId AND product_id=@productId')).recordset[0];
        if (!stock || Number(stock.quantity) < exported) throw Object.assign(new Error(`${row.product_id}: số lượng xuất vượt quá tồn kho`), { http: 409 });
        const reason = `Xuất tay khi nhận kho đầu ca${note ? `: ${note}` : ''}`;
        await db.request().input('branchId', sql.Int, session.branch_id).input('productId', sql.Int, row.product_id).input('quantity', sql.Decimal(18, 3), exported).input('referenceId', sql.Int, sessionId).input('reason', sql.NVarChar(500), reason).input('userId', sql.Int, req.user.userId).query(`
          UPDATE branch_inventories SET quantity=quantity-@quantity,updated_at=SYSDATETIME() WHERE branch_id=@branchId AND product_id=@productId;
          INSERT inventory_transactions(branch_id,product_id,transaction_type,quantity,reference_type,reference_id,reason,created_by,created_at)
          VALUES(@branchId,@productId,'transfer_out',@quantity,'shift_inventory_receive',@referenceId,@reason,@userId,SYSDATETIME())`);
      }
      await db.request().input('id', sql.BigInt, row.id).input('actual', sql.Decimal(18, 3), actual).input('imported', sql.Decimal(18, 3), imported).input('exported', sql.Decimal(18, 3), exported).input('difference', sql.Decimal(18, 3), difference).input('note', sql.NVarChar(500), note || null).query(`UPDATE shift_inventory_items SET opening_actual_quantity=@actual,actual_received_quantity=@actual,imported_quantity_in_shift=@imported,special_export_quantity_in_shift=@exported,
        receiving_difference_quantity=@difference,receiving_note=@note,updated_at=SYSDATETIME() WHERE id=@id`);
      if (difference) {
        const created = await db.request().input('sourceId', sql.BigInt, session.previous_inventory_session_id).input('sessionId', sql.BigInt, sessionId).input('branchId', sql.Int, session.branch_id).input('productId', sql.Int, row.product_id).input('declared', sql.Decimal(18, 3), expected).input('actual', sql.Decimal(18, 3), actual).input('difference', sql.Decimal(18, 3), difference).input('employeeId', sql.Int, employee.employeeId).input('isTest', sql.Bit, isTest).query(`INSERT inventory_discrepancies(source_session_id,receiving_session_id,branch_id,product_id,declared_quantity,actual_quantity,difference_quantity,detected_by_employee_id,status,is_test)
          OUTPUT INSERTED.id VALUES(@sourceId,@sessionId,@branchId,@productId,@declared,@actual,@difference,@employeeId,'PENDING',@isTest)`);
        await audit(db, { sessionId, discrepancyId: created.recordset[0].id, branchId: session.branch_id, userId: req.user.userId, action: 'DISCREPANCY_REPORTED', payload: { productId: row.product_id, difference, note } });
      }
    }
    await db.request().input('sessionId', sql.BigInt, sessionId).query("UPDATE shift_inventory_sessions SET status='IN_PROGRESS',updated_at=SYSDATETIME() WHERE id=@sessionId");
    await db.request().input('previousId', sql.BigInt, session.previous_inventory_session_id).query("UPDATE shift_inventory_sessions SET status='CLOSED',updated_at=SYSDATETIME() WHERE id=@previousId");
    await audit(db, { sessionId, branchId: session.branch_id, userId: req.user.userId, action: 'HANDOVER_RECEIVED' });
    await tx.commit(); begun = false;
    res.json({ success: true, message: 'Đã xác nhận nhận kho. Bạn có thể mở ca.', data: await load(pool, sessionId) });
  } catch (error) { if (begun) await tx.rollback().catch(() => {}); error.http ? fail(res, error.http, error.message) : next(error); }
}

async function movements(req, res, next) {
  try {
    const pool = await getPool(); await guard(pool); const data = await load(pool, Number(req.params.id));
    if (!data) return fail(res, 404, 'Không tìm thấy phiên');
    const result = await pool.request().input('branchId', sql.Int, data.branch_id).input('from', sql.DateTime2, data.received_at || data.created_at).input('to', sql.DateTime2, data.closed_at || new Date()).query(`SELECT id,product_id productId,transaction_type transactionType,quantity,reason,created_at createdAt
      FROM inventory_transactions WHERE branch_id=@branchId AND created_at BETWEEN @from AND @to ORDER BY id`);
    res.json({ success: true, data: { transactions: result.recordset, timeline: data.timeline, purchaseReceipts: data.purchaseReceipts } });
  } catch (error) { next(error); }
}

async function recordUsage(req, res, next) {
  const isTest = isTestEnv();
  const pool = await getPool(); const tx = new sql.Transaction(pool); let begun = false;
  try {
    const sessionId = Number(req.params.id);
    const requestKey = String(req.body.requestKey || '').trim();
    const note = String(req.body.note || '').trim();
    const rawItems = Array.isArray(req.body.items) ? req.body.items : [];
    if (!Number.isSafeInteger(sessionId) || sessionId < 1 || sessionId > 2147483647 || !requestKey || requestKey.length > 100) {
      return fail(res, 400, 'Dữ liệu xuất sử dụng trong ca không hợp lệ');
    }
    const grouped = new Map();
    rawItems.forEach((item) => {
      const productId = Number(item.productId); const quantity = numberValue(item.quantity);
      if (Number.isInteger(productId) && productId > 0 && quantity !== null && quantity > 0) grouped.set(productId, (grouped.get(productId) || 0) + quantity);
    });
    if (!grouped.size) return fail(res, 400, 'Hãy nhập ít nhất một số lượng xuất');

    await tx.begin(); begun = true; const db = transactional(tx); await guard(db);
    const employee = await employeeFromJwt(db, req.user.userId);
    if (!employee) throw Object.assign(new Error('Không tìm thấy hồ sơ nhân viên'), { http: 403 });
    const session = (await db.request().input('sessionId', sql.BigInt, sessionId).input('userId', sql.Int, req.user.userId).input('isTest', sql.Bit, isTest).query(`
      SELECT * FROM shift_inventory_sessions WITH(UPDLOCK,HOLDLOCK)
      WHERE id=@sessionId AND created_by_user_id=@userId AND status IN('RECEIVING','IN_PROGRESS') AND is_test=@isTest`)).recordset[0];
    if (!session) throw Object.assign(new Error('Chỉ người đang phụ trách phiên tồn trong ca mới được ghi xuất sử dụng'), { http: 403 });

    const duplicate = (await db.request().input('sessionId', sql.BigInt, sessionId).input('requestKey', sql.NVarChar(100), requestKey).query(`
      SELECT TOP 1 id FROM shift_inventory_audit_logs
      WHERE inventory_session_id=@sessionId AND action='SHIFT_USAGE_EXPORTED'
        AND JSON_VALUE(payload_json,'$.requestKey')=@requestKey`)).recordset[0];
    if (duplicate) {
      await tx.rollback(); begun = false;
      return res.json({ success: true, message: 'Lần xuất này đã được ghi nhận trước đó', data: await load(pool, sessionId) });
    }

    const savedItems = [];
    for (const [productId, quantity] of grouped) {
      const item = (await db.request().input('sessionId', sql.BigInt, sessionId).input('productId', sql.Int, productId).query(`
        SELECT i.product_id,p.product_name FROM shift_inventory_items i JOIN products p ON p.id=i.product_id
        WHERE i.session_id=@sessionId AND i.product_id=@productId`)).recordset[0];
      if (!item) throw Object.assign(new Error('Sản phẩm không thuộc danh sách tồn trong ca'), { http: 409 });
      const stock = (await db.request().input('branchId', sql.Int, session.branch_id).input('productId', sql.Int, productId).query(`
        SELECT quantity FROM branch_inventories WITH(UPDLOCK,HOLDLOCK)
        WHERE branch_id=@branchId AND product_id=@productId`)).recordset[0];
      if (!stock || Number(stock.quantity) < quantity) throw Object.assign(new Error(`${item.product_name} không đủ tồn kho`), { http: 409 });
      const reason = `Xuất sử dụng trong ca${note ? `: ${note}` : ''}`;
      await db.request().input('branchId', sql.Int, session.branch_id).input('productId', sql.Int, productId).input('quantity', sql.Decimal(18, 3), quantity)
        .input('referenceId', sql.Int, sessionId).input('reason', sql.NVarChar(500), reason).input('userId', sql.Int, req.user.userId).query(`
        UPDATE branch_inventories SET quantity=quantity-@quantity,updated_at=SYSDATETIME()
        WHERE branch_id=@branchId AND product_id=@productId;
        INSERT inventory_transactions(branch_id,product_id,transaction_type,quantity,reference_type,reference_id,reason,created_by,created_at)
        VALUES(@branchId,@productId,'transfer_out',@quantity,'shift_inventory_usage',@referenceId,@reason,@userId,SYSDATETIME())`);
      savedItems.push({ productId, quantity });
    }
    await audit(db, { sessionId, branchId: session.branch_id, userId: req.user.userId, action: 'SHIFT_USAGE_EXPORTED', payload: { requestKey, note, items: savedItems } });
    await db.request().input('sessionId',sql.BigInt,sessionId).query("UPDATE shift_inventory_sessions SET status='IN_PROGRESS',received_at=COALESCE(received_at,SYSDATETIME()),updated_at=SYSDATETIME() WHERE id=@sessionId");
    await tx.commit(); begun = false;
    res.status(201).json({ success: true, message: 'Đã ghi xuất sử dụng trong ca', data: await load(pool, sessionId) });
  } catch (error) { if (begun) await tx.rollback().catch(() => {}); error.http ? fail(res, error.http, error.message) : next(error); }
}

async function close(req, res, next) {
  const isTest = isTestEnv();
  const pool = await getPool(); const tx = new sql.Transaction(pool); let begun = false;
  try {
    await tx.begin(); begun = true; const db = transactional(tx); await guard(db);
    const sessionId = Number(req.params.id); const employee = await employeeFromJwt(db, req.user.userId); const items = req.body.items || [];
    const session = (await db.request().input('sessionId', sql.BigInt, sessionId).input('userId', sql.Int, req.user.userId).input('isTest', sql.Bit, isTest).query("SELECT * FROM shift_inventory_sessions WITH(UPDLOCK) WHERE id=@sessionId AND created_by_user_id=@userId AND status='IN_PROGRESS' AND is_test=@isTest")).recordset[0];
    if (!session) throw Object.assign(new Error('Chỉ người nhận kho đầu ca được chốt kho'), { http: 403 });
    for (const item of items) {
      const row = (await db.request().input('sessionId', sql.BigInt, sessionId).input('productId', sql.Int, Number(item.productId)).query('SELECT * FROM shift_inventory_items WITH(UPDLOCK) WHERE session_id=@sessionId AND product_id=@productId')).recordset[0];
      const closing = numberValue(item.closingQuantity); const note = String(item.note || '').trim();
      if (!row || closing === null || closing < 0) throw Object.assign(new Error('Tồn cuối không hợp lệ'), { http: 400 });
      const movement = (await db.request().input('branchId', sql.Int, session.branch_id).input('productId', sql.Int, row.product_id).input('from', sql.DateTime2, session.received_at).query(`SELECT
        COALESCE(SUM(CASE WHEN transaction_type IN('import','transfer_in','adjustment_in') THEN quantity ELSE 0 END),0) incoming,
        COALESCE(SUM(CASE WHEN transaction_type IN('sale','waste','transfer_out','adjustment_out') THEN quantity ELSE 0 END),0) outgoing
        FROM inventory_transactions WHERE branch_id=@branchId AND product_id=@productId AND created_at>=@from`)).recordset[0];
      const incoming = Number(movement.incoming); const outgoing = Number(movement.outgoing);
      const stock = (await db.request().input('branchId', sql.Int, session.branch_id).input('productId', sql.Int, row.product_id).query('SELECT quantity FROM branch_inventories WITH(UPDLOCK,HOLDLOCK) WHERE branch_id=@branchId AND product_id=@productId')).recordset[0];
      const expected = Number(stock?.quantity || 0); const difference = closing - expected;
      if (difference !== 0 && !note) throw Object.assign(new Error('Có chênh lệch tồn cuối phải nhập ghi chú'), { http: 400 });
      await db.request().input('id', sql.BigInt, row.id).input('incoming', sql.Decimal(18, 3), incoming).input('outgoing', sql.Decimal(18, 3), outgoing).input('closing', sql.Decimal(18, 3), closing).input('used', sql.Decimal(18, 3), expected - closing).input('note', sql.NVarChar(500), note || null).query(`UPDATE shift_inventory_items SET imported_quantity_in_shift=@incoming,special_export_quantity_in_shift=@outgoing,
        closing_actual_quantity=@closing,estimated_used_quantity=@used,closing_note=@note,updated_at=SYSDATETIME() WHERE id=@id`);
      if (difference !== 0) {
        const created = await db.request().input('sessionId', sql.BigInt, sessionId).input('branchId', sql.Int, session.branch_id).input('productId', sql.Int, row.product_id).input('expected', sql.Decimal(18, 3), expected).input('actual', sql.Decimal(18, 3), closing).input('difference', sql.Decimal(18, 3), difference).input('employeeId', sql.Int, employee.employeeId).input('isTest', sql.Bit, isTest).query(`INSERT inventory_discrepancies(source_session_id,receiving_session_id,branch_id,product_id,declared_quantity,actual_quantity,difference_quantity,detected_by_employee_id,status,is_test)
          OUTPUT INSERTED.id VALUES(@sessionId,@sessionId,@branchId,@productId,@expected,@actual,@difference,@employeeId,'PENDING',@isTest)`);
        await audit(db, { sessionId, discrepancyId: created.recordset[0].id, branchId: session.branch_id, userId: req.user.userId, action: 'CLOSING_DISCREPANCY_RECORDED', payload: { productId: row.product_id, expected, actual: closing, difference, note } });
      }
    }
    await db.request().input('sessionId', sql.BigInt, sessionId).input('employeeId', sql.Int, employee.employeeId).input('note', sql.NVarChar(1000), req.body.note || null).query("UPDATE shift_inventory_sessions SET status='WAITING_HANDOVER',closed_by_employee_id=@employeeId,closed_at=SYSDATETIME(),note=@note,updated_at=SYSDATETIME() WHERE id=@sessionId");
    await audit(db, { sessionId, branchId: session.branch_id, userId: req.user.userId, action: 'INVENTORY_HANDED_OVER' });
    await tx.commit(); begun = false;
    res.json({ success: true, message: 'Đã kiểm kho và bàn giao', data: await load(pool, sessionId) });
  } catch (error) { if (begun) await tx.rollback().catch(() => {}); error.http ? fail(res, error.http, error.message) : next(error); }
}

async function uploadImage(req, res, next) {
  try {
    const isTest = isTestEnv();
    const pool = await getPool(); await guard(pool); const sessionId = Number(req.params.id);
    const session = (await pool.request().input('sessionId', sql.BigInt, sessionId).input('userId', sql.Int, req.user.userId).input('isTest', sql.Bit, isTest).query('SELECT * FROM shift_inventory_sessions WHERE id=@sessionId AND created_by_user_id=@userId AND shift_session_id IS NOT NULL AND is_test=@isTest')).recordset[0];
    if (!session) { if (req.file) fs.unlink(req.file.path, () => {}); return fail(res, 409, 'Hãy mở ca trước khi tải ảnh kiểm kho'); }
    const count = await pool.request().input('sessionId', sql.BigInt, sessionId).input('isTest', sql.Bit, isTest).query(`SELECT COUNT(*) n FROM operation_attachments a
      WHERE a.attachment_type='other' AND a.is_deleted=0 AND a.is_test=@isTest AND EXISTS(SELECT 1 FROM shift_inventory_audit_logs al
        WHERE al.inventory_session_id=@sessionId AND al.action='INVENTORY_IMAGE_ADDED' AND TRY_CONVERT(BIGINT,JSON_VALUE(al.payload_json,'$.attachmentId'))=a.id)`);
    if (Number(count.recordset[0].n) >= 10) { fs.unlink(req.file.path, () => {}); return fail(res, 400, 'Tối đa 10 ảnh mỗi phiên kiểm kho'); }
    const created = await pool.request().input('shiftSessionId', sql.Int, session.shift_session_id).input('original', sql.NVarChar(255), req.file.originalname).input('stored', sql.VarChar(100), req.file.filename).input('mime', sql.VarChar(50), req.file.mimetype).input('size', sql.Int, req.file.size).input('relative', sql.NVarChar(500), req.file.filename).input('userId', sql.Int, req.user.userId).input('isTest', sql.Bit, isTest).query(`INSERT operation_attachments
      (shift_session_id,attachment_type,original_name,stored_name,mime_type,file_size,relative_path,uploaded_by,is_test)
      OUTPUT INSERTED.id attachmentId VALUES(@shiftSessionId,'other',@original,@stored,@mime,@size,@relative,@userId,@isTest)`);
    await audit(pool, { sessionId, branchId: session.branch_id, userId: req.user.userId, action: 'INVENTORY_IMAGE_ADDED', payload: { attachmentId: created.recordset[0].attachmentId } });
    res.status(201).json({ success: true, message: 'Đã tải ảnh kiểm kho', data: created.recordset[0] });
  } catch (error) { if (req.file) fs.unlink(req.file.path, () => {}); next(error); }
}

async function image(req, res, next) {
  try {
    const isTest = isTestEnv();
    const pool = await getPool(); await guard(pool);
    const result = await pool.request().input('id', sql.BigInt, req.params.attachmentId).input('isTest', sql.Bit, isTest).query(`SELECT a.relative_path relativePath,a.mime_type mimeType
      FROM operation_attachments a WHERE a.id=@id AND a.attachment_type='other' AND a.is_deleted=0 AND a.is_test=@isTest
      AND EXISTS(SELECT 1 FROM shift_inventory_audit_logs al WHERE al.action='INVENTORY_IMAGE_ADDED'
        AND TRY_CONVERT(BIGINT,JSON_VALUE(al.payload_json,'$.attachmentId'))=a.id)`);
    if (!result.recordset[0]) return fail(res, 404, 'Không tìm thấy ảnh');
    res.type(result.recordset[0].mimeType).sendFile(path.resolve(upload.root, result.recordset[0].relativePath));
  } catch (error) { next(error); }
}

async function sessions(req, res, next) {
  try {
    const isTest = isTestEnv();
    const pool = await getPool(); await guard(pool); const branchId = Number(req.query.branchId || 0); const request = pool.request().input('isTest', sql.Bit, isTest);
    if (branchId) request.input('branchId', sql.Int, branchId);
    const result = await request.query(`SELECT s.id,s.branch_id branchId,b.branch_name branchName,CONVERT(char(10),s.business_date,23) businessDate,
      s.operation_shift_code operationShift,s.status,ru.full_name receiverName,cu.full_name closerName,s.received_at receivedAt,s.closed_at closedAt,
      (SELECT COUNT(*) FROM inventory_discrepancies d WHERE d.receiving_session_id=s.id AND d.status='PENDING') pendingDiscrepancies,
      (SELECT COUNT(*) FROM purchase_receipts pr WHERE pr.branch_id=s.branch_id AND pr.created_at>=COALESCE(s.received_at,s.created_at)
        AND pr.created_at<=COALESCE(s.closed_at,SYSDATETIME())) purchaseReceiptCount
      FROM shift_inventory_sessions s JOIN branches b ON b.id=s.branch_id
      LEFT JOIN employees re ON re.id=s.received_by_employee_id LEFT JOIN users ru ON ru.id=re.user_id
      LEFT JOIN employees ce ON ce.id=s.closed_by_employee_id LEFT JOIN users cu ON cu.id=ce.user_id
      WHERE s.is_test=@isTest${branchId ? ' AND s.branch_id=@branchId' : ''} ORDER BY s.id DESC`);
    res.json({ success: true, data: result.recordset });
  } catch (error) { next(error); }
}

async function discrepancies(req, res, next) {
  try {
    const isTest = isTestEnv();
    const pool = await getPool(); await guard(pool);
    const result = await pool.request().input('isTest', sql.Bit, isTest).query(`SELECT d.*,b.branch_name branchName,p.product_name productName,u.unit_name unitName,
      du.full_name detectedBy,ru.full_name resolvedBy FROM inventory_discrepancies d JOIN branches b ON b.id=d.branch_id
      JOIN products p ON p.id=d.product_id JOIN units u ON u.id=p.unit_id JOIN employees de ON de.id=d.detected_by_employee_id
      JOIN users du ON du.id=de.user_id LEFT JOIN users ru ON ru.id=d.resolved_by_user_id
      WHERE d.is_test=@isTest ORDER BY CASE d.status WHEN 'PENDING' THEN 0 ELSE 1 END,d.id DESC`);
    res.json({ success: true, data: result.recordset });
  } catch (error) { next(error); }
}

async function resolve(req, res, next) {
  const isTest = isTestEnv();
  const pool = await getPool(); const tx = new sql.Transaction(pool); let begun = false;
  try {
    const action = req.body.action; const note = String(req.body.note || '').trim();
    if (!['adjustment_in', 'adjustment_out', 'no_adjustment'].includes(action) || !note) return fail(res, 400, 'Phải chọn xử lý và nhập lý do');
    await tx.begin(); begun = true; const db = transactional(tx); await guard(db); const id = Number(req.params.id);
    const discrepancy = (await db.request().input('id', sql.BigInt, id).input('isTest', sql.Bit, isTest).query("SELECT * FROM inventory_discrepancies WITH(UPDLOCK) WHERE id=@id AND status='PENDING' AND is_test=@isTest")).recordset[0];
    if (!discrepancy) throw Object.assign(new Error('Chênh lệch đã xử lý hoặc không tồn tại'), { http: 409 });
    let transactionId = null;
    if (action !== 'no_adjustment') {
      const quantity = Math.abs(Number(discrepancy.difference_quantity));
      const created = await db.request().input('branchId', sql.Int, discrepancy.branch_id).input('productId', sql.Int, discrepancy.product_id).input('type', sql.VarChar(30), action).input('quantity', sql.Decimal(18, 3), quantity).input('referenceId', sql.Int, id).input('note', sql.NVarChar(500), note).input('userId', sql.Int, req.user.userId).query(`INSERT inventory_transactions
        (branch_id,product_id,transaction_type,quantity,unit_cost,reference_type,reference_id,reason,created_by)
        OUTPUT INSERTED.id VALUES(@branchId,@productId,@type,@quantity,0,'inventory_discrepancy',@referenceId,@note,@userId)`);
      transactionId = created.recordset[0].id;
      await db.request().input('branchId', sql.Int, discrepancy.branch_id).input('productId', sql.Int, discrepancy.product_id).input('value', sql.Decimal(18, 3), action === 'adjustment_in' ? quantity : -quantity).query(`UPDATE branch_inventories
        SET quantity=CASE WHEN quantity+@value<0 THEN 0 ELSE quantity+@value END,updated_at=SYSDATETIME()
        WHERE branch_id=@branchId AND product_id=@productId`);
    }
    await db.request().input('id', sql.BigInt, id).input('action', sql.VarChar(20), action).input('note', sql.NVarChar(1000), note).input('userId', sql.Int, req.user.userId).input('transactionId', sql.BigInt, transactionId).query(`UPDATE inventory_discrepancies SET status='RESOLVED',resolution_action=@action,resolution_note=@note,
      resolved_by_user_id=@userId,resolved_at=SYSDATETIME(),adjustment_transaction_id=@transactionId,updated_at=SYSDATETIME() WHERE id=@id`);
    await audit(db, { discrepancyId: id, branchId: discrepancy.branch_id, userId: req.user.userId, action: 'DISCREPANCY_RESOLVED', payload: { action, note, transactionId } });
    await tx.commit(); begun = false; res.json({ success: true, message: 'Đã xử lý chênh lệch' });
  } catch (error) { if (begun) await tx.rollback().catch(() => {}); error.http ? fail(res, error.http, error.message) : next(error); }
}

async function detail(req, res, next) {
  try {
    const pool = await getPool(); await guard(pool); const data = await load(pool, Number(req.params.id));
    if (!data) return fail(res, 404, 'Không tìm thấy phiên');
    const employee = await employeeFromJwt(pool, req.user.userId);
    if (!['admin', 'manager'].includes(req.user.role) && Number(employee?.branchId) !== Number(data.branch_id)) return fail(res, 403, 'Không có quyền xem');
    res.json({ success: true, data });
  } catch (error) { next(error); }
}

module.exports = { options, baseline, current, start, receive, movements, recordUsage, close, uploadImage, image, sessions, discrepancies, resolve, detail };
