const { sql, getPool } = require("../config/db");
const scheduleTestMode=process.env.NODE_ENV!=="production"&&String(process.env.ENABLE_SCHEDULE_TEST_MODE).toLowerCase()==="true";

async function getEmployee(pool, userId) {
  const result = await pool.request().input("userId", sql.Int, userId).query(`
    SELECT TOP 1 e.id AS employeeId,e.branch_id AS branchId,e.position_id AS positionId,
      e.employee_code AS employeeCode,p.position_name AS positionName,b.branch_name AS branchName
    FROM employees e
    INNER JOIN positions p ON p.id=e.position_id
    INNER JOIN branches b ON b.id=e.branch_id
    WHERE e.user_id=@userId AND e.status='working'
  `);
  return result.recordset[0];
}

function validDate(value) { return /^\d{4}-\d{2}-\d{2}$/.test(String(value || "")); }

async function mySchedules(req,res,next){try{
  const {from,to}=req.query;
  if(!validDate(from)||!validDate(to)||from>to)return res.status(400).json({success:false,message:"Khoảng ngày không hợp lệ"});
  const pool=await getPool(),employee=await getEmployee(pool,req.user.userId);
  if(!employee)return res.status(404).json({success:false,message:"Không tìm thấy nhân viên"});
  const result=await pool.request().input("employeeId",sql.Int,employee.employeeId).input("from",sql.Date,from).input("to",sql.Date,to).input("testMode",sql.Bit,scheduleTestMode).query(`
    SELECT es.id AS scheduleId,CONVERT(char(10),es.work_date,23) AS workDate,s.shift_code AS shiftCode,s.shift_name AS shiftName,
      s.start_time AS startTime,s.end_time AS endTime,p.position_name AS positionName,b.branch_name AS branchName,
      es.work_position AS workPosition,es.note,es.status
    FROM employee_schedules es
    INNER JOIN shifts s ON s.id=es.shift_id
    INNER JOIN employees e ON e.id=es.employee_id
    INNER JOIN positions p ON p.id=e.position_id
    INNER JOIN branches b ON b.id=es.branch_id
    WHERE es.employee_id=@employeeId AND es.work_date BETWEEN @from AND @to AND (es.is_test=0 OR @testMode=1)
      AND EXISTS (
        SELECT 1 FROM schedule_registration_periods rp
        WHERE rp.branch_id=es.branch_id AND rp.status='published'
          AND es.work_date BETWEEN rp.week_start_date AND rp.week_end_date
      )
    ORDER BY es.work_date,s.start_time
  `);
  res.json({success:true,data:result.recordset});
}catch(error){next(error)}}

async function myAttendance(req,res,next){try{
  const pool=await getPool(),employee=await getEmployee(pool,req.user.userId);
  if(!employee)return res.status(404).json({success:false,message:"Không tìm thấy nhân viên"});
  const result=await pool.request().input("employeeId",sql.Int,employee.employeeId).query(`
    SELECT TOP 1 es.id AS scheduleId,s.shift_name AS shiftName,s.start_time AS startTime,s.end_time AS endTime
    FROM employee_schedules es INNER JOIN shifts s ON s.id=es.shift_id
    WHERE es.employee_id=@employeeId AND es.work_date=CAST(GETDATE() AS date) AND es.status<>'cancelled'
    ORDER BY s.start_time;
    SELECT attendance_type AS attendanceType,attendance_time AS attendanceTime,source,note
    FROM attendance_logs WHERE employee_id=@employeeId AND CAST(attendance_time AS date)=CAST(GETDATE() AS date)
    ORDER BY attendance_time;
    SELECT TOP 10 attendance_type AS attendanceType,attendance_time AS attendanceTime,source,note
    FROM attendance_logs WHERE employee_id=@employeeId ORDER BY attendance_time DESC;
  `);
  const today=result.recordsets[1],checkIn=today.find(x=>x.attendanceType==="check_in")?.attendanceTime||null;
  const checkOut=[...today].reverse().find(x=>x.attendanceType==="check_out")?.attendanceTime||null;
  res.json({success:true,data:{schedule:result.recordsets[0][0]||null,checkIn,checkOut,recent:result.recordsets[2]}});
}catch(error){next(error)}}

async function currentShiftSession(req,res,next){try{
  const pool=await getPool(),employee=await getEmployee(pool,req.user.userId);
  if(!employee)return res.status(404).json({success:false,message:"Không tìm thấy nhân viên"});
  const result=await pool.request().input("employeeId",sql.Int,employee.employeeId).query(`
    SELECT TOP 1 ss.id AS shiftSessionId,ss.business_date AS businessDate,ss.opened_at AS openedAt,
      ss.closed_at AS closedAt,ss.opening_cash AS openingCash,ss.status,ss.note,
      s.shift_name AS shiftName,s.start_time AS startTime,s.end_time AS endTime,
      b.branch_name AS branchName,p.position_name AS positionName
    FROM shift_sessions ss INNER JOIN shifts s ON s.id=ss.shift_id
    INNER JOIN branches b ON b.id=ss.branch_id INNER JOIN employees e ON e.id=ss.employee_id
    INNER JOIN positions p ON p.id=e.position_id
    WHERE ss.employee_id=@employeeId AND ss.status='open' ORDER BY ss.opened_at DESC
  `);
  res.json({success:true,data:result.recordset[0]||null});
}catch(error){next(error)}}

async function openShiftSession(req,res,next){try{
  const openingCash=Number(req.body.openingCash),note=req.body.note||null;
  if(!Number.isFinite(openingCash)||openingCash<0)return res.status(400).json({success:false,message:"Tiền đầu ca không hợp lệ"});
  const pool=await getPool(),employee=await getEmployee(pool,req.user.userId);
  if(!employee)return res.status(404).json({success:false,message:"Không tìm thấy nhân viên"});
  const existing=await pool.request().input("employeeId",sql.Int,employee.employeeId).query("SELECT TOP 1 id FROM shift_sessions WHERE employee_id=@employeeId AND status='open'");
  if(existing.recordset[0])return res.status(409).json({success:false,message:"Bạn đang có một ca mở"});
  const schedule=await pool.request().input("employeeId",sql.Int,employee.employeeId).query(`
    SELECT TOP 1 es.id AS scheduleId,es.shift_id AS shiftId,es.branch_id AS branchId
    FROM employee_schedules es INNER JOIN shifts s ON s.id=es.shift_id
    WHERE es.employee_id=@employeeId AND es.work_date=CAST(GETDATE() AS date) AND es.status IN ('scheduled','working')
    ORDER BY s.start_time
  `);
  if(!schedule.recordset[0])return res.status(400).json({success:false,message:"Không có lịch làm hợp lệ hôm nay"});
  const item=schedule.recordset[0];
  const result=await pool.request().input("employeeId",sql.Int,employee.employeeId).input("scheduleId",sql.Int,item.scheduleId)
    .input("shiftId",sql.Int,item.shiftId).input("branchId",sql.Int,item.branchId)
    .input("openingCash",sql.Decimal(18,2),openingCash).input("note",sql.NVarChar(500),note).query(`
      INSERT INTO shift_sessions(branch_id,employee_id,schedule_id,shift_id,business_date,opening_cash,status,note)
      OUTPUT INSERTED.id AS shiftSessionId,INSERTED.opened_at AS openedAt,INSERTED.opening_cash AS openingCash,INSERTED.status
      VALUES(@branchId,@employeeId,@scheduleId,@shiftId,CAST(GETDATE() AS date),@openingCash,'open',@note);
      UPDATE employee_schedules SET status='working',updated_at=SYSDATETIME() WHERE id=@scheduleId;
    `);
  res.status(201).json({success:true,message:"Mở ca thành công",data:result.recordset[0]});
}catch(error){next(error)}}

async function closeShiftSession(req,res,next){const pool=await getPool(),transaction=new sql.Transaction(pool);let started=false;try{
  const fields=["cashRevenue","transferRevenue","ewalletRevenue","deliveryRevenue","actualCash"];
  const values=Object.fromEntries(fields.map(key=>[key,Number(req.body[key]||0)]));
  if(Object.values(values).some(value=>!Number.isFinite(value)||value<0))return res.status(400).json({success:false,message:"Số tiền không hợp lệ"});
  const employee=await getEmployee(pool,req.user.userId);if(!employee)return res.status(404).json({success:false,message:"Không tìm thấy nhân viên"});
  await transaction.begin();started=true;
  const current=await new sql.Request(transaction).input("employeeId",sql.Int,employee.employeeId).query("SELECT TOP 1 * FROM shift_sessions WITH (UPDLOCK) WHERE employee_id=@employeeId AND status='open' ORDER BY opened_at DESC");
  if(!current.recordset[0]){await transaction.rollback();started=false;return res.status(409).json({success:false,message:"Không có ca đang mở"})}
  const session=current.recordset[0];
  const expenseResult=await new sql.Request(transaction).input("sessionId",sql.Int,session.id).query("SELECT COALESCE(SUM(amount),0) AS totalExpense FROM shift_expenses WHERE shift_session_id=@sessionId AND status<>'rejected'");
  const totalExpense=Number(expenseResult.recordset[0].totalExpense),totalRevenue=values.cashRevenue+values.transferRevenue+values.ewalletRevenue+values.deliveryRevenue;
  const expectedCash=Number(session.opening_cash)+values.cashRevenue-totalExpense,difference=values.actualCash-expectedCash;
  const result=await new sql.Request(transaction).input("sessionId",sql.Int,session.id).input("employeeId",sql.Int,employee.employeeId)
    .input("businessDate",sql.Date,session.business_date).input("openingCash",sql.Decimal(18,2),session.opening_cash)
    .input("cash",sql.Decimal(18,2),values.cashRevenue).input("transfer",sql.Decimal(18,2),values.transferRevenue)
    .input("ewallet",sql.Decimal(18,2),values.ewalletRevenue).input("delivery",sql.Decimal(18,2),values.deliveryRevenue)
    .input("totalRevenue",sql.Decimal(18,2),totalRevenue).input("expense",sql.Decimal(18,2),totalExpense)
    .input("expected",sql.Decimal(18,2),expectedCash).input("actual",sql.Decimal(18,2),values.actualCash)
    .input("difference",sql.Decimal(18,2),difference).input("note",sql.NVarChar(1000),req.body.note||null)
    .input("scheduleId",sql.Int,session.schedule_id).query(`
      INSERT INTO shift_closing_reports(shift_session_id,employee_id,business_date,opening_cash,cash_revenue,
        transfer_revenue,ewallet_revenue,delivery_revenue,total_revenue,total_expense,expected_cash,actual_cash,difference_amount,note,status)
      OUTPUT INSERTED.* VALUES(@sessionId,@employeeId,@businessDate,@openingCash,@cash,@transfer,@ewallet,@delivery,
        @totalRevenue,@expense,@expected,@actual,@difference,@note,'submitted');
      UPDATE shift_sessions SET status='closed',closed_at=SYSDATETIME() WHERE id=@sessionId;
      UPDATE employee_schedules SET status='completed',updated_at=SYSDATETIME() WHERE id=@scheduleId;
    `);
  await transaction.commit();started=false;res.status(201).json({success:true,message:"Đóng ca thành công",data:result.recordset[0]});
}catch(error){if(started)await transaction.rollback().catch(()=>{});next(error)}}

async function myShiftReports(req,res,next){try{const pool=await getPool(),employee=await getEmployee(pool,req.user.userId);if(!employee)return res.status(404).json({success:false,message:"Không tìm thấy nhân viên"});const result=await pool.request().input("employeeId",sql.Int,employee.employeeId).query(`
  SELECT r.id AS reportId,r.business_date AS businessDate,s.shift_name AS shiftName,r.opening_cash AS openingCash,
    r.cash_revenue AS cashRevenue,r.transfer_revenue AS transferRevenue,r.ewallet_revenue AS ewalletRevenue,
    r.delivery_revenue AS deliveryRevenue,r.total_revenue AS totalRevenue,r.total_expense AS totalExpense,
    r.expected_cash AS expectedCash,r.actual_cash AS actualCash,r.difference_amount AS differenceAmount,
    r.note,r.status,r.closed_at AS closedAt,r.manager_note AS managerNote
  FROM shift_closing_reports r INNER JOIN shift_sessions ss ON ss.id=r.shift_session_id
  INNER JOIN shifts s ON s.id=ss.shift_id WHERE r.employee_id=@employeeId ORDER BY r.business_date DESC,r.closed_at DESC
`);res.json({success:true,data:result.recordset})}catch(error){next(error)}}

async function myExpenses(req,res,next){try{const pool=await getPool(),employee=await getEmployee(pool,req.user.userId);if(!employee)return res.status(404).json({success:false,message:"Không tìm thấy nhân viên"});const date=validDate(req.query.date)?req.query.date:new Date().toISOString().slice(0,10);const result=await pool.request().input("employeeId",sql.Int,employee.employeeId).input("date",sql.Date,date).query(`
  SELECT se.id,se.expense_date AS expenseDate,se.amount,se.title,se.note,se.status,ec.id AS categoryId,ec.category_name AS categoryName
  FROM shift_expenses se INNER JOIN expense_categories ec ON ec.id=se.expense_category_id
  WHERE se.employee_id=@employeeId AND CAST(se.expense_date AS date)=@date ORDER BY se.expense_date DESC;
  SELECT id,category_name AS categoryName FROM expense_categories WHERE status='active' ORDER BY category_name;
`);res.json({success:true,data:result.recordsets[0],categories:result.recordsets[1]})}catch(error){next(error)}}

async function createExpense(req,res,next){try{const amount=Number(req.body.amount),categoryId=Number(req.body.categoryId);if(!Number.isFinite(amount)||amount<=0||!Number.isInteger(categoryId)||!req.body.title)return res.status(400).json({success:false,message:"Thông tin chi phí không hợp lệ"});const pool=await getPool(),employee=await getEmployee(pool,req.user.userId);if(!employee)return res.status(404).json({success:false,message:"Không tìm thấy nhân viên"});const session=await pool.request().input("employeeId",sql.Int,employee.employeeId).query("SELECT TOP 1 id FROM shift_sessions WHERE employee_id=@employeeId AND status='open' ORDER BY opened_at DESC");if(!session.recordset[0])return res.status(409).json({success:false,message:"Cần mở ca trước khi ghi chi phí"});const result=await pool.request().input("sessionId",sql.Int,session.recordset[0].id).input("categoryId",sql.Int,categoryId).input("employeeId",sql.Int,employee.employeeId).input("amount",sql.Decimal(18,2),amount).input("title",sql.NVarChar(200),req.body.title).input("note",sql.NVarChar(1000),req.body.note||null).query("INSERT INTO shift_expenses(shift_session_id,expense_category_id,employee_id,amount,title,note,status) OUTPUT INSERTED.id VALUES(@sessionId,@categoryId,@employeeId,@amount,@title,@note,'submitted')");res.status(201).json({success:true,message:"Đã ghi nhận chi phí",data:{id:result.recordset[0].id}})}catch(error){next(error)}}

async function myLeaveRequests(req,res,next){try{const pool=await getPool(),employee=await getEmployee(pool,req.user.userId);if(!employee)return res.status(404).json({success:false,message:"Không tìm thấy nhân viên"});const result=await pool.request().input("employeeId",sql.Int,employee.employeeId).query("SELECT id,leave_date AS leaveDate,reason,status,manager_note AS managerNote,created_at AS createdAt FROM leave_requests WHERE employee_id=@employeeId ORDER BY leave_date DESC");res.json({success:true,data:result.recordset})}catch(error){next(error)}}
async function createLeaveRequest(req,res,next){try{if(!validDate(req.body.leaveDate)||!String(req.body.reason||"").trim())return res.status(400).json({success:false,message:"Ngày nghỉ và lý do là bắt buộc"});const pool=await getPool(),employee=await getEmployee(pool,req.user.userId);if(!employee)return res.status(404).json({success:false,message:"Không tìm thấy nhân viên"});const result=await pool.request().input("employeeId",sql.Int,employee.employeeId).input("date",sql.Date,req.body.leaveDate).input("reason",sql.NVarChar(500),req.body.reason.trim()).query("INSERT INTO leave_requests(employee_id,leave_date,reason,status) OUTPUT INSERTED.id VALUES(@employeeId,@date,@reason,'pending')");res.status(201).json({success:true,message:"Đã gửi yêu cầu nghỉ",data:{id:result.recordset[0].id}})}catch(error){next(error)}}

async function myNotifications(req,res,next){try{const pool=await getPool();const result=await pool.request().input("userId",sql.Int,req.user.userId).query("SELECT id,notification_type AS notificationType,title,content,reference_type AS referenceType,reference_id AS referenceId,is_read AS isRead,created_at AS createdAt FROM notifications WHERE user_id=@userId ORDER BY created_at DESC");res.json({success:true,data:result.recordset})}catch(error){next(error)}}
async function readNotification(req,res,next){try{const pool=await getPool();const result=await pool.request().input("id",sql.BigInt,req.params.id).input("userId",sql.Int,req.user.userId).query("UPDATE notifications SET is_read=1 OUTPUT INSERTED.id WHERE id=@id AND user_id=@userId");if(!result.recordset[0])return res.status(404).json({success:false,message:"Không tìm thấy thông báo"});res.json({success:true,message:"Đã đánh dấu đã đọc"})}catch(error){next(error)}}

const vietnamNowSql="CAST(SYSUTCDATETIME() AT TIME ZONE 'UTC' AT TIME ZONE 'SE Asia Standard Time' AS datetime2)";
// SQL Server lưu DATETIME2 theo giờ tường Asia/Ho_Chi_Minh. msnodesqlv8 đã trả
// đúng các thành phần giờ này trong Date, vì vậy không được trừ thêm 7 giờ.
const sqlLocalIso=value=>value instanceof Date?value.toISOString():value;
function normalizeAttendanceTimes(attendance){
  if(!attendance)return attendance;
  return {...attendance,checkInTime:sqlLocalIso(attendance.checkInTime),checkOutTime:sqlLocalIso(attendance.checkOutTime)};
}
const publishedScheduleSql=`
  SELECT TOP 1 es.id AS scheduleId,CONVERT(char(10),es.work_date,23) AS workDate,es.status,es.is_test AS isTest,
    s.shift_code AS shiftCode,s.shift_name AS shiftName,s.start_time AS startTime,s.end_time AS endTime,
    es.branch_id AS branchId,b.branch_name AS branchName,p.position_name AS positionName
  FROM employee_schedules es
  JOIN shifts s ON s.id=es.shift_id AND s.status='active'
  JOIN employees e ON e.id=es.employee_id JOIN users u ON u.id=e.user_id
  JOIN branches b ON b.id=es.branch_id JOIN positions p ON p.id=e.position_id
  WHERE es.employee_id=@employeeId
    AND (es.work_date=CAST(${vietnamNowSql} AS date) OR (es.is_test=1 AND @testMode=1))
    AND (es.is_test=0 OR @testMode=1)
    AND es.status<>'cancelled'
    AND EXISTS(SELECT 1 FROM schedule_registration_periods rp WHERE rp.branch_id=es.branch_id
      AND rp.status='published' AND es.work_date BETWEEN rp.week_start_date AND rp.week_end_date)
  ORDER BY CASE WHEN es.work_date=CAST(${vietnamNowSql} AS date) THEN 0 ELSE 1 END,es.work_date DESC,s.start_time`;

async function attendanceTodayData(pool,userId){
  const employeeResult=await pool.request().input("userId",sql.Int,userId).query(`
    SELECT TOP 1 e.id AS employeeId,e.employee_code AS employeeCode,u.full_name AS fullName,
      e.branch_id AS branchId,b.branch_name AS branchName,p.position_name AS positionName
    FROM employees e JOIN users u ON u.id=e.user_id JOIN branches b ON b.id=e.branch_id JOIN positions p ON p.id=e.position_id
    WHERE e.user_id=@userId AND e.status='working' AND u.status='active'`);
  const employee=employeeResult.recordset[0];
  if(!employee)return null;
  const result=await pool.request().input("employeeId",sql.Int,employee.employeeId).input("testMode",sql.Bit,scheduleTestMode).query(`
    ${publishedScheduleSql};
    SELECT TOP 1 id AS attendanceId,schedule_id AS scheduleId,check_in_time AS checkInTime,
      check_out_time AS checkOutTime,COALESCE(worked_minutes,0) AS workedMinutes,
      COALESCE(late_minutes,0) AS lateMinutes,COALESCE(early_leave_minutes,0) AS earlyLeaveMinutes,
      CASE WHEN check_out_time IS NOT NULL THEN 'completed' WHEN check_in_time IS NOT NULL THEN 'working' ELSE 'not_checked_in' END AS status,is_test AS isTest,note
    FROM attendance_logs WHERE employee_id=@employeeId
      AND (work_date=CAST(${vietnamNowSql} AS date) OR (is_test=1 AND @testMode=1))
      AND (is_test=0 OR @testMode=1) AND check_in_time IS NOT NULL
    ORDER BY CASE WHEN work_date=CAST(${vietnamNowSql} AS date) THEN 0 ELSE 1 END,work_date DESC,check_in_time DESC;
    SELECT ${vietnamNowSql} AS serverTime;`);
  const schedule=result.recordsets[0][0]||null,attendance=result.recordsets[1][0]||null;
  if(attendance&&!schedule&&attendance.scheduleId){
    const historical=await pool.request().input("id",sql.Int,attendance.scheduleId).query(`
      SELECT es.id AS scheduleId,CONVERT(char(10),es.work_date,23) AS workDate,es.status,es.is_test AS isTest,s.shift_code AS shiftCode,
        s.shift_name AS shiftName,s.start_time AS startTime,s.end_time AS endTime,es.branch_id AS branchId,
        b.branch_name AS branchName,p.position_name AS positionName
      FROM employee_schedules es JOIN shifts s ON s.id=es.shift_id JOIN branches b ON b.id=es.branch_id
      JOIN employees e ON e.id=es.employee_id JOIN positions p ON p.id=e.position_id WHERE es.id=@id`);
    return {employee,schedule:historical.recordset[0]||null,attendance:normalizeAttendanceTimes(attendance),serverTime:sqlLocalIso(result.recordsets[2][0].serverTime)};
  }
  return {employee,schedule,attendance:schedule?normalizeAttendanceTimes(attendance):null,serverTime:sqlLocalIso(result.recordsets[2][0].serverTime)};
}

async function attendanceToday(req,res,next){try{
  const data=await attendanceTodayData(await getPool(),req.user.userId);
  if(!data)return res.status(404).json({success:false,message:"Không tìm thấy hồ sơ nhân viên"});
  res.json({success:true,data});
}catch(error){next(error)}}

async function attendanceCheckIn(req,res,next){
  const pool=await getPool(),transaction=new sql.Transaction(pool);let started=false;
  try{
    await transaction.begin();started=true;
    const employee=await new sql.Request(transaction).input("userId",sql.Int,req.user.userId).query("SELECT TOP 1 id AS employeeId FROM employees WHERE user_id=@userId AND status='working'");
    if(!employee.recordset[0]){await transaction.rollback();started=false;return res.status(404).json({success:false,message:"Không tìm thấy hồ sơ nhân viên"})}
    const employeeId=employee.recordset[0].employeeId,scheduleId=Number(req.body.scheduleId);
    const schedule=await new sql.Request(transaction).input("employeeId",sql.Int,employeeId).input("scheduleId",sql.Int,scheduleId).input("testMode",sql.Bit,scheduleTestMode).query(`
      SELECT TOP 1 es.id AS scheduleId,es.branch_id AS branchId,es.work_date AS workDate,es.is_test AS isTest,s.start_time AS startTime,
        DATEADD(SECOND,DATEDIFF(SECOND,CAST('00:00' AS time),s.start_time),CAST(es.work_date AS datetime2)) AS shiftStart,
        ${vietnamNowSql} AS serverTime
      FROM employee_schedules es JOIN shifts s ON s.id=es.shift_id AND s.status='active'
      WHERE es.id=@scheduleId AND es.employee_id=@employeeId
        AND (es.work_date=CAST(${vietnamNowSql} AS date) OR (es.is_test=1 AND @testMode=1))
        AND (es.is_test=0 OR @testMode=1)
        AND es.status<>'cancelled' AND EXISTS(SELECT 1 FROM schedule_registration_periods rp
          WHERE rp.branch_id=es.branch_id AND rp.status='published' AND es.work_date BETWEEN rp.week_start_date AND rp.week_end_date)`);
    const shift=schedule.recordset[0];
    if(!shift){await transaction.rollback();started=false;return res.status(404).json({success:false,message:"Bạn không có lịch làm hôm nay."})}
    const existing=await new sql.Request(transaction).input("scheduleId",sql.Int,scheduleId).input("employeeId",sql.Int,employeeId)
      .query("SELECT id FROM attendance_logs WITH(UPDLOCK,HOLDLOCK) WHERE schedule_id=@scheduleId AND employee_id=@employeeId AND check_in_time IS NOT NULL");
    if(existing.recordset[0]){await transaction.rollback();started=false;return res.status(409).json({success:false,message:"Bạn đã chấm công vào cho ca này."})}
    if(!shift.isTest&&new Date(shift.serverTime)<new Date(shift.shiftStart).getTime()-30*60000){await transaction.rollback();started=false;return res.status(409).json({success:false,message:"Chưa đến thời gian chấm công. Bạn có thể chấm vào trước ca 30 phút."})}
    const lateMinutes=shift.isTest?0:Math.max(0,Math.floor((new Date(shift.serverTime)-new Date(shift.shiftStart))/60000));
    await new sql.Request(transaction).input("employeeId",sql.Int,employeeId).input("scheduleId",sql.Int,scheduleId)
      .input("branchId",sql.Int,shift.branchId).input("workDate",sql.Date,shift.workDate).input("late",sql.Int,lateMinutes).input("isTest",sql.Bit,Boolean(shift.isTest))
      .input("note",sql.NVarChar(255),String(req.body.note||"").trim()||null).query(`
        DECLARE @now datetime2=${vietnamNowSql};
        INSERT attendance_logs(employee_id,schedule_id,branch_id,work_date,attendance_type,attendance_time,check_in_time,
          late_minutes,early_leave_minutes,status,source,note,is_test,created_at,updated_at)
        VALUES(@employeeId,@scheduleId,@branchId,@workDate,'check_in',@now,@now,@late,0,
          CASE WHEN @late>0 THEN 'late' ELSE 'working' END,'manual',@note,@isTest,@now,@now)`);
    await transaction.commit();started=false;
    const data=await attendanceTodayData(pool,req.user.userId);
    res.status(201).json({success:true,message:`Chấm công vào thành công lúc ${new Date(data.attendance.checkInTime).toLocaleTimeString("vi-VN",{hour:"2-digit",minute:"2-digit",timeZone:"Asia/Ho_Chi_Minh"})}`,data});
  }catch(error){if(started)await transaction.rollback().catch(()=>{});if(error.number===2601||error.number===2627)return res.status(409).json({success:false,message:"Bạn đã chấm công vào cho ca này."});next(error)}
}

async function attendanceCheckOut(req,res,next){
  const pool=await getPool(),transaction=new sql.Transaction(pool);let started=false;
  try{
    await transaction.begin();started=true;
    const employee=await new sql.Request(transaction).input("userId",sql.Int,req.user.userId).query("SELECT TOP 1 id AS employeeId FROM employees WHERE user_id=@userId AND status='working'");
    if(!employee.recordset[0]){await transaction.rollback();started=false;return res.status(404).json({success:false,message:"Không tìm thấy hồ sơ nhân viên"})}
    const employeeId=employee.recordset[0].employeeId,scheduleId=Number(req.body.scheduleId);
    const result=await new sql.Request(transaction).input("employeeId",sql.Int,employeeId).input("scheduleId",sql.Int,scheduleId).input("testMode",sql.Bit,scheduleTestMode).query(`
      SELECT TOP 1 al.id,al.check_in_time AS checkInTime,al.check_out_time AS checkOutTime,al.is_test AS isTest,es.work_date AS workDate,s.end_time AS endTime,
        DATEADD(day,CASE WHEN s.end_time<=s.start_time THEN 1 ELSE 0 END,
          DATEADD(SECOND,DATEDIFF(SECOND,CAST('00:00' AS time),s.end_time),CAST(es.work_date AS datetime2))) AS shiftEnd,
        ${vietnamNowSql} AS serverTime
      FROM attendance_logs al JOIN employee_schedules es ON es.id=al.schedule_id JOIN shifts s ON s.id=es.shift_id
      WHERE al.employee_id=@employeeId AND al.schedule_id=@scheduleId AND es.employee_id=@employeeId
        AND (es.work_date=CAST(${vietnamNowSql} AS date) OR (es.is_test=1 AND @testMode=1))
        AND (es.is_test=0 OR @testMode=1) AND al.check_in_time IS NOT NULL`);
    const attendance=result.recordset[0];
    if(!attendance){await transaction.rollback();started=false;return res.status(409).json({success:false,message:"Bạn chưa chấm công vào."})}
    if(attendance.checkOutTime){await transaction.rollback();started=false;return res.status(409).json({success:false,message:"Bạn đã hoàn tất chấm công cho ca này."})}
    const worked=Math.max(0,Math.floor((new Date(attendance.serverTime)-new Date(attendance.checkInTime))/60000));
    const early=attendance.isTest?0:Math.max(0,Math.ceil((new Date(attendance.shiftEnd)-new Date(attendance.serverTime))/60000));
    await new sql.Request(transaction).input("id",sql.BigInt,attendance.id).input("worked",sql.Int,worked).input("early",sql.Int,early)
      .input("note",sql.NVarChar(255),String(req.body.note||"").trim()||null).query(`
        DECLARE @now datetime2=${vietnamNowSql};
        UPDATE attendance_logs SET check_out_time=@now,worked_minutes=@worked,early_leave_minutes=@early,status='completed',
          note=COALESCE(@note,note),updated_at=@now WHERE id=@id AND check_out_time IS NULL`);
    await transaction.commit();started=false;
    const data=await attendanceTodayData(pool,req.user.userId);
    res.json({success:true,message:`Chấm công ra thành công lúc ${new Date(data.attendance.checkOutTime).toLocaleTimeString("vi-VN",{hour:"2-digit",minute:"2-digit",timeZone:"Asia/Ho_Chi_Minh"})}`,data});
  }catch(error){if(started)await transaction.rollback().catch(()=>{});next(error)}
}

async function attendanceHistory(req,res,next){try{
  const month=/^\d{4}-(0[1-9]|1[0-2])$/.test(String(req.query.month||""))?req.query.month:null;
  if(!month)return res.status(400).json({success:false,message:"Tháng phải có định dạng YYYY-MM"});
  const pool=await getPool(),employee=await getEmployee(pool,req.user.userId);
  if(!employee)return res.status(404).json({success:false,message:"Không tìm thấy hồ sơ nhân viên"});
  const start=new Date(`${month}-01T00:00:00`),end=new Date(start);end.setMonth(end.getMonth()+1);
  const result=await pool.request().input("employeeId",sql.Int,employee.employeeId).input("start",sql.Date,start).input("end",sql.Date,end).query(`
    SELECT al.id AS attendanceId,CONVERT(char(10),al.work_date,23) AS workDate,s.shift_code AS shiftCode,s.shift_name AS shiftName,
      al.check_in_time AS checkInTime,al.check_out_time AS checkOutTime,COALESCE(al.worked_minutes,0) AS workedMinutes,
      COALESCE(al.late_minutes,0) AS lateMinutes,COALESCE(al.early_leave_minutes,0) AS earlyLeaveMinutes,
      CASE WHEN al.check_out_time IS NOT NULL THEN 'completed' ELSE 'working' END AS status,al.is_test AS isTest
    FROM attendance_logs al JOIN employee_schedules es ON es.id=al.schedule_id JOIN shifts s ON s.id=es.shift_id
    WHERE al.employee_id=@employeeId AND al.work_date>=@start AND al.work_date<@end AND al.check_in_time IS NOT NULL
      AND (al.is_test=0 OR ${scheduleTestMode?1:0}=1)
    ORDER BY al.work_date DESC,al.check_in_time DESC`);
  res.json({success:true,data:result.recordset.map(row=>({...row,checkInTime:sqlLocalIso(row.checkInTime),checkOutTime:sqlLocalIso(row.checkOutTime)}))});
}catch(error){next(error)}}

module.exports={mySchedules,myAttendance,attendanceToday,attendanceCheckIn,attendanceCheckOut,attendanceHistory,currentShiftSession,openShiftSession,closeShiftSession,myShiftReports,myExpenses,createExpense,myLeaveRequests,createLeaveRequest,myNotifications,readNotification};
