const { sql, getPool } = require("../config/db");

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
  const result=await pool.request().input("employeeId",sql.Int,employee.employeeId).input("from",sql.Date,from).input("to",sql.Date,to).query(`
    SELECT es.id AS scheduleId,CONVERT(char(10),es.work_date,23) AS workDate,s.shift_code AS shiftCode,s.shift_name AS shiftName,
      s.start_time AS startTime,s.end_time AS endTime,p.position_name AS positionName,b.branch_name AS branchName,
      es.work_position AS workPosition,es.note,es.status
    FROM employee_schedules es
    INNER JOIN shifts s ON s.id=es.shift_id
    INNER JOIN employees e ON e.id=es.employee_id
    INNER JOIN positions p ON p.id=e.position_id
    INNER JOIN branches b ON b.id=es.branch_id
    WHERE es.employee_id=@employeeId AND es.work_date BETWEEN @from AND @to
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

module.exports={mySchedules,myAttendance,currentShiftSession,openShiftSession,closeShiftSession,myShiftReports,myExpenses,createExpense,myLeaveRequests,createLeaveRequest,myNotifications,readNotification};
