const {sql,getPool}=require("../config/db");

const fail=(res,status,message)=>res.status(status).json({success:false,message});
const validDate=value=>/^\d{4}-\d{2}-\d{2}$/.test(String(value||""));
const validDateTime=value=>/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?$/.test(String(value||""));
const allowedStatuses=new Set(["not_checked_in","working","completed","late","early_leave","missing_checkout"]);
const allowedDataTypes=new Set(["all","real","test"]);

async function managerBranch(pool,user){
  if(user.role==="admin")return null;
  const result=await pool.request().input("userId",sql.Int,user.userId).query(`
    SELECT TOP 1 branch_id AS branchId FROM employees
    WHERE user_id=@userId AND status='working'`);
  return result.recordset[0]?.branchId||null;
}

async function scopeFor(req,res){
  const pool=await getPool(),branchId=await managerBranch(pool,req.user);
  if(req.user.role!=="admin"&&!branchId){
    fail(res,403,"Tài khoản quản lý chưa được gán chi nhánh.");
    return null;
  }
  return {pool,branchId};
}

const rowSql=`
  SELECT al.id AS attendanceId,es.id AS scheduleId,CONVERT(char(10),es.work_date,23) AS workDate,
    e.id AS employeeId,e.employee_code AS employeeCode,u.full_name AS fullName,
    p.id AS positionId,p.position_name AS positionName,b.id AS branchId,b.branch_name AS branchName,
    s.shift_code AS shiftCode,s.shift_name AS shiftName,
    CONVERT(char(5),s.start_time,108) AS shiftStartTime,CONVERT(char(5),s.end_time,108) AS shiftEndTime,
    CONVERT(char(19),al.check_in_time,126) AS checkInTime,
    CONVERT(char(19),al.check_out_time,126) AS checkOutTime,
    al.worked_minutes AS workedMinutes,ISNULL(al.late_minutes,0) AS lateMinutes,
    ISNULL(al.early_leave_minutes,0) AS earlyLeaveMinutes,
    CASE
      WHEN al.id IS NULL THEN 'not_checked_in'
      WHEN al.check_in_time IS NOT NULL AND al.check_out_time IS NULL
        AND es.work_date<CAST(SYSDATETIME() AS date) THEN 'missing_checkout'
      WHEN al.check_out_time IS NOT NULL THEN 'completed'
      ELSE 'working'
    END AS status,
    CAST(COALESCE(al.is_test,es.is_test,0) AS bit) AS isTest,
    al.note,al.adjustment_reason AS adjustmentReason,al.updated_by AS updatedBy,
    editor.full_name AS updatedByName,CONVERT(char(19),al.updated_at,126) AS updatedAt
  FROM employee_schedules es
  JOIN employees e ON e.id=es.employee_id
  JOIN users u ON u.id=e.user_id
  JOIN positions p ON p.id=e.position_id
  JOIN branches b ON b.id=es.branch_id
  JOIN shifts s ON s.id=es.shift_id
  LEFT JOIN attendance_logs al ON al.schedule_id=es.id AND al.employee_id=es.employee_id
    AND al.check_in_time IS NOT NULL
  LEFT JOIN users editor ON editor.id=al.updated_by`;

function bindFilters(request,query,scopeBranch){
  const from=query.from,to=query.to;
  request.input("from",sql.Date,from).input("to",sql.Date,to);
  const where=[
    "es.work_date BETWEEN @from AND @to",
    "es.status<>'cancelled'",
    `EXISTS(SELECT 1 FROM schedule_registration_periods rp
      WHERE rp.branch_id=es.branch_id AND rp.status='published'
        AND es.work_date BETWEEN rp.week_start_date AND rp.week_end_date)`
  ];
  const branchId=scopeBranch||Number(query.branchId||0);
  if(branchId){where.push("es.branch_id=@branchId");request.input("branchId",sql.Int,branchId)}
  const employeeId=Number(query.employeeId||0);
  if(employeeId){where.push("es.employee_id=@employeeId");request.input("employeeId",sql.Int,employeeId)}
  const positionId=Number(query.positionId||0);
  if(positionId){where.push("e.position_id=@positionId");request.input("positionId",sql.Int,positionId)}
  const search=String(query.search||"").trim();
  if(search){where.push("(u.full_name LIKE @search OR e.employee_code LIKE @search)");request.input("search",sql.NVarChar(210),`%${search}%`)}
  const dataType=allowedDataTypes.has(query.dataType)?query.dataType:"all";
  if(dataType==="real")where.push("COALESCE(al.is_test,es.is_test,0)=0");
  if(dataType==="test")where.push("COALESCE(al.is_test,es.is_test,0)=1");
  return where;
}

function statusCondition(status){
  const values={
    not_checked_in:"al.id IS NULL",
    working:"al.check_in_time IS NOT NULL AND al.check_out_time IS NULL AND es.work_date>=CAST(SYSDATETIME() AS date)",
    completed:"al.check_out_time IS NOT NULL",
    late:"ISNULL(al.late_minutes,0)>0",
    early_leave:"ISNULL(al.early_leave_minutes,0)>0",
    missing_checkout:"al.check_in_time IS NOT NULL AND al.check_out_time IS NULL AND es.work_date<CAST(SYSDATETIME() AS date)"
  };
  return values[status]||null;
}

async function list(req,res,next){try{
  if(!validDate(req.query.from)||!validDate(req.query.to)||req.query.from>req.query.to)return fail(res,400,"Khoảng ngày không hợp lệ.");
  const scope=await scopeFor(req,res);if(!scope)return;
  const page=Math.max(1,Number.parseInt(req.query.page,10)||1);
  const limit=Math.min(100,Math.max(1,Number.parseInt(req.query.limit,10)||20));
  const request=scope.pool.request(),where=bindFilters(request,req.query,scope.branchId);
  if(allowedStatuses.has(req.query.status))where.push(statusCondition(req.query.status));
  request.input("offset",sql.Int,(page-1)*limit).input("limit",sql.Int,limit);
  const result=await request.query(`
    ${rowSql}
    WHERE ${where.join(" AND ")}
    ORDER BY es.work_date DESC,s.start_time,u.full_name
    OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY;

    SELECT COUNT_BIG(1) AS total,
      SUM(CASE WHEN al.check_in_time IS NOT NULL THEN 1 ELSE 0 END) AS checkedIn,
      SUM(CASE WHEN al.check_out_time IS NOT NULL THEN 1 ELSE 0 END) AS completed,
      SUM(CASE WHEN al.id IS NULL THEN 1 ELSE 0 END) AS notCheckedIn,
      SUM(CASE WHEN ISNULL(al.late_minutes,0)>0 OR
        (al.check_in_time IS NOT NULL AND al.check_out_time IS NULL AND es.work_date<CAST(SYSDATETIME() AS date))
        THEN 1 ELSE 0 END) AS attention
    FROM employee_schedules es
    JOIN employees e ON e.id=es.employee_id JOIN users u ON u.id=e.user_id
    JOIN positions p ON p.id=e.position_id JOIN branches b ON b.id=es.branch_id JOIN shifts s ON s.id=es.shift_id
    LEFT JOIN attendance_logs al ON al.schedule_id=es.id AND al.employee_id=es.employee_id AND al.check_in_time IS NOT NULL
    WHERE ${where.join(" AND ")};
  `);
  const summary=result.recordsets[1][0]||{};
  const total=Number(summary.total||0);
  res.json({success:true,data:{
    items:result.recordsets[0],
    summary:{scheduled:total,checkedIn:Number(summary.checkedIn||0),completed:Number(summary.completed||0),notCheckedIn:Number(summary.notCheckedIn||0),attention:Number(summary.attention||0)},
    pagination:{page,limit,total,totalPages:Math.max(1,Math.ceil(total/limit))}
  }});
}catch(error){next(error)}}

async function options(req,res,next){try{
  const scope=await scopeFor(req,res);if(!scope)return;
  const request=scope.pool.request(),condition=scope.branchId?"WHERE b.id=@branchId":"";
  if(scope.branchId)request.input("branchId",sql.Int,scope.branchId);
  const result=await request.query(`
    SELECT b.id AS branchId,b.branch_name AS branchName FROM branches b ${condition} ORDER BY b.branch_name;
    SELECT DISTINCT e.id AS employeeId,e.employee_code AS employeeCode,u.full_name AS fullName,e.branch_id AS branchId
      FROM employees e JOIN users u ON u.id=e.user_id ${scope.branchId?"WHERE e.branch_id=@branchId":""} ORDER BY u.full_name;
    SELECT id AS positionId,position_name AS positionName FROM positions ORDER BY position_name;`);
  res.json({success:true,data:{branches:result.recordsets[0],employees:result.recordsets[1],positions:result.recordsets[2]}});
}catch(error){next(error)}}

async function detail(req,res,next){try{
  const id=Number(req.params.attendanceId);if(!Number.isInteger(id))return fail(res,400,"Mã chấm công không hợp lệ.");
  const scope=await scopeFor(req,res);if(!scope)return;
  const request=scope.pool.request().input("id",sql.BigInt,id);
  const where=["al.id=@id"];
  if(scope.branchId){where.push("es.branch_id=@branchId");request.input("branchId",sql.Int,scope.branchId)}
  const result=await request.query(`${rowSql} WHERE ${where.join(" AND ")}`);
  if(!result.recordset[0])return fail(res,404,"Không tìm thấy chấm công.");
  res.json({success:true,data:result.recordset[0]});
}catch(error){next(error)}}

function parseDateTime(value){
  if(!validDateTime(value))return null;
  const normalized=value.length===16?`${value}:00`:value;
  const [datePart,timePart]=normalized.split("T");
  const [year,month,day]=datePart.split("-").map(Number);
  const [hour,minute,second]=timePart.split(":").map(Number);
  // DateTime2 không mang múi giờ. Dùng UTC components để driver không tự trừ
  // thêm 7 giờ khỏi "giờ tường" Asia/Ho_Chi_Minh người quản lý đã nhập.
  const date=new Date(Date.UTC(year,month-1,day,hour,minute,second||0));
  return Number.isNaN(date.getTime())?null:date;
}

async function payrollWarning(transaction,employeeId,workDate){
  const month=`${workDate.slice(0,7)}-01`;
  const result=await new sql.Request(transaction).input("employeeId",sql.Int,employeeId).input("month",sql.Date,month)
    .query("SELECT TOP 1 status FROM payrolls WHERE employee_id=@employeeId AND payroll_month=@month AND status IN ('confirmed','paid')");
  return result.recordset[0]?.status||null;
}

async function update(req,res,next){
  const pool=await getPool(),transaction=new sql.Transaction(pool);let started=false;
  try{
    const id=Number(req.params.attendanceId),reason=String(req.body.reason||"").trim();
    const checkIn=parseDateTime(req.body.checkInTime),checkOut=req.body.checkOutTime?parseDateTime(req.body.checkOutTime):null;
    if(!Number.isInteger(id)||!checkIn||!reason)return fail(res,400,"Giờ vào và lý do chỉnh sửa là bắt buộc.");
    if(req.body.checkOutTime&&!checkOut)return fail(res,400,"Giờ ra không hợp lệ.");
    if(checkOut&&checkOut<checkIn)return fail(res,400,"Giờ ra không được nhỏ hơn giờ vào.");
    await transaction.begin();started=true;
    const scope=await managerBranch(pool,req.user);
    if(req.user.role!=="admin"&&!scope){await transaction.rollback();started=false;return fail(res,403,"Tài khoản quản lý chưa được gán chi nhánh.")}
    const request=new sql.Request(transaction).input("id",sql.BigInt,id);
    if(scope)request.input("branchId",sql.Int,scope);
    const current=await request.query(`
      SELECT al.id,al.employee_id AS employeeId,CONVERT(char(10),es.work_date,23) AS workDate,
        es.is_test AS isTest,s.start_time AS startTime,s.end_time AS endTime
      FROM attendance_logs al JOIN employee_schedules es ON es.id=al.schedule_id JOIN shifts s ON s.id=es.shift_id
      WHERE al.id=@id${scope?" AND es.branch_id=@branchId":""}`);
    const row=current.recordset[0];
    if(!row){await transaction.rollback();started=false;return fail(res,404,"Không tìm thấy chấm công.")}
    const warning=await payrollWarning(transaction,row.employeeId,row.workDate);
    const result=await new sql.Request(transaction).input("id",sql.BigInt,id).input("checkIn",sql.DateTime2,checkIn)
      .input("checkOut",sql.DateTime2,checkOut).input("reason",sql.NVarChar(500),reason).input("userId",sql.Int,req.user.userId)
      .query(`
        UPDATE al SET check_in_time=@checkIn,check_out_time=@checkOut,
          attendance_time=@checkIn,worked_minutes=CASE WHEN @checkOut IS NULL THEN NULL
            ELSE (DATEDIFF(SECOND,@checkIn,@checkOut)+59)/60 END,
          late_minutes=CASE WHEN @checkIn>DATEADD(SECOND,DATEDIFF(SECOND,CAST('00:00' AS time),s.start_time),CAST(es.work_date AS datetime2))
            THEN DATEDIFF(MINUTE,DATEADD(SECOND,DATEDIFF(SECOND,CAST('00:00' AS time),s.start_time),CAST(es.work_date AS datetime2)),@checkIn) ELSE 0 END,
          early_leave_minutes=CASE WHEN @checkOut IS NOT NULL AND @checkOut<
            DATEADD(day,CASE WHEN s.end_time<=s.start_time THEN 1 ELSE 0 END,DATEADD(SECOND,DATEDIFF(SECOND,CAST('00:00' AS time),s.end_time),CAST(es.work_date AS datetime2)))
            THEN DATEDIFF(MINUTE,@checkOut,DATEADD(day,CASE WHEN s.end_time<=s.start_time THEN 1 ELSE 0 END,DATEADD(SECOND,DATEDIFF(SECOND,CAST('00:00' AS time),s.end_time),CAST(es.work_date AS datetime2)))) ELSE 0 END,
          status=CASE WHEN @checkOut IS NULL THEN 'working' ELSE 'completed' END,
          adjustment_reason=@reason,updated_by=@userId,updated_at=SYSDATETIME()
        OUTPUT INSERTED.id
        FROM attendance_logs al JOIN employee_schedules es ON es.id=al.schedule_id JOIN shifts s ON s.id=es.shift_id
        WHERE al.id=@id`);
    await transaction.commit();started=false;
    res.json({success:true,message:"Cập nhật chấm công thành công.",data:{attendanceId:result.recordset[0].id,payrollLocked:Boolean(warning),payrollStatus:warning}});
  }catch(error){if(started)await transaction.rollback().catch(()=>{});next(error)}
}

async function manual(req,res,next){
  const pool=await getPool(),transaction=new sql.Transaction(pool);let started=false;
  try{
    const scheduleId=Number(req.body.scheduleId),reason=String(req.body.reason||"").trim();
    const checkIn=parseDateTime(req.body.checkInTime),checkOut=req.body.checkOutTime?parseDateTime(req.body.checkOutTime):null;
    if(!Number.isInteger(scheduleId)||!checkIn||!reason)return fail(res,400,"Lịch làm, giờ vào và lý do là bắt buộc.");
    if(req.body.checkOutTime&&!checkOut)return fail(res,400,"Giờ ra không hợp lệ.");
    if(checkOut&&checkOut<checkIn)return fail(res,400,"Giờ ra không được nhỏ hơn giờ vào.");
    await transaction.begin();started=true;
    const scope=await managerBranch(pool,req.user);
    if(req.user.role!=="admin"&&!scope){await transaction.rollback();started=false;return fail(res,403,"Tài khoản quản lý chưa được gán chi nhánh.")}
    const request=new sql.Request(transaction).input("scheduleId",sql.Int,scheduleId);
    if(scope)request.input("branchId",sql.Int,scope);
    const schedule=await request.query(`
      SELECT es.id,es.employee_id AS employeeId,es.branch_id AS branchId,CONVERT(char(10),es.work_date,23) AS workDate,
        es.is_test AS isTest,s.start_time AS startTime,s.end_time AS endTime
      FROM employee_schedules es JOIN shifts s ON s.id=es.shift_id
      WHERE es.id=@scheduleId AND es.status<>'cancelled'${scope?" AND es.branch_id=@branchId":""}
        AND EXISTS(SELECT 1 FROM schedule_registration_periods rp WHERE rp.branch_id=es.branch_id
          AND rp.status='published' AND es.work_date BETWEEN rp.week_start_date AND rp.week_end_date)`);
    const row=schedule.recordset[0];
    if(!row){await transaction.rollback();started=false;return fail(res,404,"Không tìm thấy lịch làm hợp lệ.")}
    const duplicate=await new sql.Request(transaction).input("scheduleId",sql.Int,scheduleId)
      .query("SELECT id FROM attendance_logs WITH(UPDLOCK,HOLDLOCK) WHERE schedule_id=@scheduleId AND check_in_time IS NOT NULL");
    if(duplicate.recordset[0]){await transaction.rollback();started=false;return fail(res,409,"Lịch này đã có dữ liệu chấm công.")}
    const warning=await payrollWarning(transaction,row.employeeId,row.workDate);
    const result=await new sql.Request(transaction).input("employeeId",sql.Int,row.employeeId).input("scheduleId",sql.Int,scheduleId)
      .input("branchId",sql.Int,row.branchId).input("workDate",sql.Date,row.workDate).input("checkIn",sql.DateTime2,checkIn)
      .input("checkOut",sql.DateTime2,checkOut).input("reason",sql.NVarChar(500),reason).input("isTest",sql.Bit,Boolean(row.isTest))
      .input("userId",sql.Int,req.user.userId).query(`
        INSERT attendance_logs(employee_id,schedule_id,branch_id,work_date,attendance_type,attendance_time,
          check_in_time,check_out_time,worked_minutes,late_minutes,early_leave_minutes,status,source,note,is_test,
          adjustment_reason,updated_by,created_at,updated_at)
        OUTPUT INSERTED.id
        SELECT @employeeId,@scheduleId,@branchId,@workDate,'check_in',@checkIn,@checkIn,@checkOut,
          CASE WHEN @checkOut IS NULL THEN NULL ELSE (DATEDIFF(SECOND,@checkIn,@checkOut)+59)/60 END,
          CASE WHEN @checkIn>shiftStart THEN DATEDIFF(MINUTE,shiftStart,@checkIn) ELSE 0 END,
          CASE WHEN @checkOut IS NOT NULL AND @checkOut<shiftEnd THEN DATEDIFF(MINUTE,@checkOut,shiftEnd) ELSE 0 END,
          CASE WHEN @checkOut IS NULL THEN 'working' ELSE 'completed' END,'manual',@reason,@isTest,@reason,@userId,SYSDATETIME(),SYSDATETIME()
        FROM (
          SELECT DATEADD(SECOND,DATEDIFF(SECOND,CAST('00:00' AS time),s.start_time),CAST(es.work_date AS datetime2)) shiftStart,
            DATEADD(day,CASE WHEN s.end_time<=s.start_time THEN 1 ELSE 0 END,
              DATEADD(SECOND,DATEDIFF(SECOND,CAST('00:00' AS time),s.end_time),CAST(es.work_date AS datetime2))) shiftEnd
          FROM employee_schedules es JOIN shifts s ON s.id=es.shift_id WHERE es.id=@scheduleId
        ) times`);
    await transaction.commit();started=false;
    res.status(201).json({success:true,message:"Bổ sung chấm công thành công.",data:{attendanceId:result.recordset[0].id,payrollLocked:Boolean(warning),payrollStatus:warning}});
  }catch(error){if(started)await transaction.rollback().catch(()=>{});if(error.number===2601||error.number===2627)return fail(res,409,"Lịch này đã có dữ liệu chấm công.");next(error)}
}

module.exports={list,options,detail,update,manual};
