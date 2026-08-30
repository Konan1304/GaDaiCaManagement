const { sql, getPool } = require('../config/db');
const { businessNow } = require('../services/businessClockService');
const { employeeFromJwt, eligibility } = require('../services/shiftEligibilityService');
const { record } = require('../services/shiftEventService');

const fail = (res, status, message, data) => res.status(status).json({ success: false, message, data });
const validOperation = value => ['morning', 'evening'].includes(value);
const executor = tx => ({ request: () => new sql.Request(tx) });
const isTestEnv = () => (process.env.APP_ENV === 'sandbox' ? 1 : 0);
// Sandbox requests pin eligibility to the exact published schedule selected at attendance.

const selectSession = `SELECT ss.id AS shiftSessionId,ss.branch_id AS branchId,b.branch_name AS branchName,CONVERT(char(10),ss.business_date,23) AS businessDate,
 ss.operation_shift_code AS operationShift,ss.leader_employee_id AS leaderEmployeeId,u.full_name AS leaderName,ss.opened_at AS openedAt,
 ss.opening_cash AS openingCash,ss.status,ss.report_submitted_at AS reportSubmittedAt,ss.handed_over_at AS handedOverAt,ss.locked_at AS lockedAt,ss.note
 FROM dbo.shift_sessions ss JOIN dbo.branches b ON b.id=ss.branch_id LEFT JOIN dbo.employees le ON le.id=ss.leader_employee_id LEFT JOIN dbo.users u ON u.id=le.user_id`;

async function current(req, res, next) { try {
  const isTest = isTestEnv();
  const pool = await getPool(); const clock = await businessNow(pool);
  const requestedDate = process.env.APP_ENV === 'sandbox' && /^\d{4}-\d{2}-\d{2}$/.test(req.query.date || '') ? req.query.date : clock.businessDate;
  const selectedScheduleId = process.env.APP_ENV === 'sandbox' ? Number(req.query.scheduleId || 0) || null : null;
  const employee = await employeeFromJwt(pool, req.user.userId);
  if (!employee?.employeeId) return fail(res, 404, 'Không tìm thấy hồ sơ nhân viên');
  const sessions = await pool.request().input('branchId', sql.Int, employee.branchId).input('date', sql.Date, requestedDate).input('isTest', sql.Bit, isTest).query(`${selectSession} WHERE ss.branch_id=@branchId AND ss.business_date=@date AND ss.is_test=@isTest AND ss.operation_shift_code IS NOT NULL ORDER BY CASE ss.operation_shift_code WHEN 'morning' THEN 1 ELSE 2 END;
   SELECT ss.id AS shiftSessionId,CONVERT(char(10),ss.business_date,23) AS businessDate,ss.operation_shift_code AS operationShift,u.full_name AS reporterName,r.total_revenue AS totalRevenue,r.cash_revenue AS cashRevenue,r.grab_revenue AS grabRevenue,r.shopeefood_revenue AS shopeefoodRevenue,r.be_revenue AS beRevenue,r.mpos_revenue AS mposRevenue,r.xanh_sm_revenue AS xanhSmRevenue,r.actual_cash AS actualCash,r.difference_amount AS differenceAmount,r.cash_to_deposit AS cashToDeposit,r.note,r.submitted_at AS submittedAt
   FROM shift_sessions ss JOIN shift_closing_reports r ON r.shift_session_id=ss.id AND r.is_test=@isTest LEFT JOIN employees e ON e.id=ss.leader_employee_id LEFT JOIN users u ON u.id=e.user_id
   WHERE ss.branch_id=@branchId AND ss.is_test=@isTest AND r.status='submitted' AND ((ss.operation_shift_code='morning' AND ss.business_date=@date) OR (ss.operation_shift_code='evening' AND ss.business_date=DATEADD(day,-1,@date)))`);
  const cards = [];
  for (const operationShift of ['morning', 'evening']) {
    const state = await eligibility(pool, { userId: req.user.userId, businessDate: requestedDate, operationShift, scheduleId: selectedScheduleId });
    const session = sessions.recordsets[0].find(x => x.operationShift === operationShift) || null;
    const inventory = (await pool.request().input('b', sql.Int, employee.branchId).input('d', sql.Date, requestedDate).input('o', sql.VarChar(10), operationShift).input('u', sql.Int, req.user.userId).input('isTest', sql.Bit, isTest).query("SELECT TOP 1 id,status FROM shift_inventory_sessions WHERE branch_id=@b AND business_date=@d AND operation_shift_code=@o AND created_by_user_id=@u AND is_test=@isTest ORDER BY id DESC")).recordset[0] || null;
    const reasons = [...state.reasons];
    if (!session && !isTest && inventory?.status !== 'IN_PROGRESS') reasons.push('Chưa kiểm và xác nhận nhận kho đầu ca');
    cards.push({ operationShift, session, incomingReport: sessions.recordsets[1].find(x => x.operationShift === (operationShift === 'morning' ? 'evening' : 'morning')) || null, inventorySession: inventory || null, eligibility: { allowed: reasons.length === 0, reasons, hasSchedule: Boolean(state.schedule), hasAttendance: Boolean(state.attendance) }, leader: session ? { employeeId: session.leaderEmployeeId, name: session.leaderName, role: 'reporter' } : null });
  }
  res.json({ success: true, data: { businessDateTime: clock.businessDateTime, businessDate: requestedDate, branchId: employee.branchId, shifts: cards } });
} catch (error) { next(error); } }

async function list(req, res, next) { try {
  const isTest = isTestEnv();
  const pool=await getPool(),clock=await businessNow(pool),employee=await employeeFromJwt(pool,req.user.userId),date=/^\d{4}-\d{2}-\d{2}$/.test(req.query.date||'')?req.query.date:clock.businessDate,operation=req.query.operationShift;
  const branchId=req.user.role==='employee'?employee?.branchId:Number(req.query.branchId||employee?.branchId);
  if(!branchId)return fail(res,400,'Chi nhánh không hợp lệ');
  const request=pool.request().input('branchId',sql.Int,branchId).input('date',sql.Date,date).input('isTest',sql.Bit,isTest);
  if(operation){if(!validOperation(operation))return fail(res,400,'Ca vận hành không hợp lệ');request.input('operation',sql.VarChar(10),operation)}
  const result=await request.query(`${selectSession} WHERE ss.branch_id=@branchId AND ss.business_date=@date AND ss.is_test=@isTest${operation?' AND ss.operation_shift_code=@operation':''} ORDER BY ss.operation_shift_code`);
  res.json({success:true,data:result.recordset});
}catch(error){next(error)} }

async function detail(req,res,next){try{
  const isTest = isTestEnv();
  const pool=await getPool(),employee=await employeeFromJwt(pool,req.user.userId),request=pool.request().input('id',sql.Int,req.params.id).input('isTest',sql.Bit,isTest);
  if(req.user.role==='employee')request.input('branchId',sql.Int,employee.branchId);
  const r=await request.query(`${selectSession} WHERE ss.id=@id AND ss.is_test=@isTest${req.user.role==='employee'?' AND ss.branch_id=@branchId':''}`);
  if(!r.recordset[0])return fail(res,404,'Không tìm thấy phiên ca');
  res.json({success:true,data:r.recordset[0]});
}catch(error){next(error)}}

async function getEligibility(req,res,next){try{
  const isTest = isTestEnv();
  const pool=await getPool(),session=await pool.request().input('id',sql.Int,req.params.id).input('isTest',sql.Bit,isTest).query('SELECT operation_shift_code AS operationShift,business_date AS businessDate FROM dbo.shift_sessions WHERE id=@id AND is_test=@isTest');
  if(!session.recordset[0])return fail(res,404,'Không tìm thấy phiên ca');
  const state=await eligibility(pool,{userId:req.user.userId,businessDate:session.recordset[0].businessDate,operationShift:session.recordset[0].operationShift});
  res.json({success:true,data:state});
}catch(error){next(error)}}

async function open(req,res,next){
  const isTest = isTestEnv();
  const pool=await getPool(),tx=new sql.Transaction(pool);let started=false;try{
  const operationShift=String(req.body.operationShift||'');if(!validOperation(operationShift))return fail(res,400,'Ca vận hành không hợp lệ');
  await tx.begin();started=true;const db=executor(tx),clock=await businessNow(db),businessDate=process.env.APP_ENV==='sandbox'&&/^\d{4}-\d{2}-\d{2}$/.test(req.body.businessDate||'')?req.body.businessDate:clock.businessDate;
  const selectedScheduleId=process.env.APP_ENV==='sandbox'?Number(req.body.scheduleId||0)||null:null;
  const state=await eligibility(db,{userId:req.user.userId,businessDate,operationShift,scheduleId:selectedScheduleId});if(!state.allowed){await tx.rollback();started=false;return fail(res,403,'Không đủ điều kiện mở ca',state.reasons)}
  let inventorySessionId=null;
  const inventory=(await db.request().input('b',sql.Int,state.employee.branchId).input('d',sql.Date,businessDate).input('o',sql.VarChar(10),operationShift).input('u',sql.Int,req.user.userId).input('isTest',sql.Bit,isTest).query("SELECT TOP 1 id FROM shift_inventory_sessions WITH(UPDLOCK,HOLDLOCK) WHERE branch_id=@b AND business_date=@d AND operation_shift_code=@o AND created_by_user_id=@u AND shift_session_id IS NULL AND status='IN_PROGRESS' AND is_test=@isTest ORDER BY id DESC")).recordset[0];
  if(!inventory&&!isTest){await tx.rollback();started=false;return fail(res,409,'Bạn phải kiểm và xác nhận nhận kho trước khi mở ca')} inventorySessionId=inventory?.id||null;
  const cash=await db.request().query("SELECT TRY_CONVERT(decimal(18,2),setting_value) AS amount FROM dbo.system_settings WHERE setting_key='DEFAULT_SHIFT_OPENING_CASH'");const openingCash=Number(cash.recordset[0]?.amount);if(!Number.isFinite(openingCash))throw new Error('Thiếu cấu hình DEFAULT_SHIFT_OPENING_CASH');
  const result=await db.request().input('branchId',sql.Int,state.employee.branchId).input('employeeId',sql.Int,state.employee.employeeId).input('scheduleId',sql.Int,state.schedule.scheduleId).input('shiftId',sql.Int,state.schedule.shiftId).input('date',sql.Date,businessDate).input('operation',sql.VarChar(10),operationShift).input('userId',sql.Int,req.user.userId).input('cash',sql.Decimal(18,2),openingCash).input('note',sql.NVarChar(500),String(req.body.note||'').trim()||null).input('isTest',sql.Bit,isTest).query("INSERT dbo.shift_sessions(branch_id,employee_id,schedule_id,shift_id,business_date,opening_cash,status,note,operation_shift_code,leader_employee_id,opened_by,is_test,updated_at) OUTPUT INSERTED.id AS shiftSessionId VALUES(@branchId,@employeeId,@scheduleId,@shiftId,@date,@cash,'OPEN',@note,@operation,@employeeId,@userId,@isTest,SYSDATETIME())");
  const id=result.recordset[0].shiftSessionId;if(inventorySessionId)await db.request().input('i',sql.BigInt,inventorySessionId).input('s',sql.Int,id).query('UPDATE shift_inventory_sessions SET shift_session_id=@s,updated_at=SYSDATETIME() WHERE id=@i AND shift_session_id IS NULL');
  await record(db,{sessionId:id,branchId:state.employee.branchId,userId:req.user.userId,employeeId:state.employee.employeeId,action:'SHIFT_OPENED',newStatus:'OPEN',payload:{businessDate,operationShift,openingCash}});await tx.commit();started=false;res.status(201).json({success:true,message:'Mở ca thành công',data:{shiftSessionId:id,openingCash,businessDate,operationShift}});
}catch(error){if(started)await tx.rollback().catch(()=>{});if([2601,2627].includes(error.number))return fail(res,409,'Ca này đã được mở');next(error)}}
module.exports={current,list,detail,getEligibility,open};
