const {sql,getPool}=require("../config/db");

const fail=(res,status,message)=>res.status(status).json({success:false,message});
const validDate=value=>/^\d{4}-\d{2}-\d{2}$/.test(String(value||""));
const scenarios=new Set(["on_time","late_5","late_15","late_30","early_15","early_30","overtime_30","overtime_60","missing_checkout","absent","manual"]);

async function sandboxPool(){
  if(process.env.APP_ENV!=="sandbox")throw Object.assign(new Error("Attendance Test Mode chỉ hoạt động trong Sandbox"),{status:404});
  const pool=await getPool();
  const result=await pool.request().query("SELECT DB_NAME() AS databaseName");
  if(!/_Test$/i.test(result.recordset[0]?.databaseName||""))throw Object.assign(new Error("Từ chối: database không phải Sandbox"),{status:403});
  return pool;
}

function parseWallDateTime(value){
  if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?$/.test(String(value||"")))return null;
  const [date,time]=value.split("T"),[year,month,day]=date.split("-").map(Number),[hour,minute,second=0]=time.split(":").map(Number);
  const result=new Date(Date.UTC(year,month-1,day,hour,minute,second));
  return Number.isNaN(result.getTime())?null:result;
}
const formatWall=date=>`${date.getUTCFullYear()}-${String(date.getUTCMonth()+1).padStart(2,"0")}-${String(date.getUTCDate()).padStart(2,"0")}T${String(date.getUTCHours()).padStart(2,"0")}:${String(date.getUTCMinutes()).padStart(2,"0")}:00`;
const addMinutes=(date,minutes)=>new Date(date.getTime()+minutes*60000);

async function options(req,res,next){try{
  const pool=await sandboxPool(),scope=req.user.role==="manager"?await pool.request().input("userId",sql.Int,req.user.userId).query("SELECT TOP 1 branch_id AS branchId FROM employees WHERE user_id=@userId AND status='working'"):null;
  const branchId=scope?.recordset[0]?.branchId||null;
  if(req.user.role==="manager"&&!branchId)return fail(res,403,"Tài khoản Manager chưa được gán chi nhánh Sandbox");
  const request=pool.request();if(branchId)request.input("branchId",sql.Int,branchId);
  const result=await request.query(`
    SELECT id AS branchId,branch_name AS branchName,branch_code AS branchCode FROM branches ${branchId?"WHERE id=@branchId":""} ORDER BY branch_name;
    SELECT p.id AS periodId,p.title,p.branch_id AS branchId,b.branch_name AS branchName,CONVERT(char(10),p.week_start_date,23) AS startDate,CONVERT(char(10),p.week_end_date,23) AS endDate
    FROM schedule_registration_periods p JOIN branches b ON b.id=p.branch_id WHERE p.status='published' AND p.is_test=1${branchId?" AND p.branch_id=@branchId":""} ORDER BY p.week_start_date DESC;
    SELECT e.id AS employeeId,e.employee_code AS employeeCode,u.full_name AS fullName,e.branch_id AS branchId FROM employees e JOIN users u ON u.id=e.user_id WHERE e.status='working' AND u.status='active'${branchId?" AND e.branch_id=@branchId":""} ORDER BY u.full_name;`);
  res.json({success:true,data:{branches:result.recordsets[0],periods:result.recordsets[1],employees:result.recordsets[2]}});
}catch(error){if(error.status)return fail(res,error.status,error.message);next(error)}}

async function schedules(req,res,next){try{
  const pool=await sandboxPool(),periodId=Number(req.query.periodId),from=req.query.from,to=req.query.to,employeeId=Number(req.query.employeeId||0);
  if(!Number.isInteger(periodId)||!validDate(from)||!validDate(to)||from>to)return fail(res,400,"Bộ lọc lịch kiểm thử không hợp lệ");
  const request=pool.request().input("periodId",sql.Int,periodId).input("from",sql.Date,from).input("to",sql.Date,to);
  if(employeeId)request.input("employeeId",sql.Int,employeeId);
  if(req.user.role==="manager")request.input("userId",sql.Int,req.user.userId);
  const result=await request.query(`
    SELECT es.id AS scheduleId,es.employee_id AS employeeId,e.employee_code AS employeeCode,u.full_name AS fullName,es.branch_id AS branchId,b.branch_name AS branchName,
      CONVERT(char(10),es.work_date,23) AS workDate,s.shift_code AS shiftCode,s.shift_name AS shiftName,
      CONVERT(char(5),COALESCE(es.start_time_override,s.start_time),108) AS startTime,CONVERT(char(5),COALESCE(es.end_time_override,s.end_time),108) AS endTime,
      al.id AS attendanceId,al.status AS attendanceStatus,CAST(CASE WHEN al.id IS NULL THEN 0 ELSE 1 END AS bit) AS hasAttendance
    FROM employee_schedules es JOIN employees e ON e.id=es.employee_id JOIN users u ON u.id=e.user_id JOIN branches b ON b.id=es.branch_id JOIN shifts s ON s.id=es.shift_id
    JOIN schedule_registration_periods rp ON rp.id=@periodId AND rp.branch_id=es.branch_id AND rp.status='published' AND rp.is_test=1 AND es.work_date BETWEEN rp.week_start_date AND rp.week_end_date
    LEFT JOIN attendance_logs al ON al.schedule_id=es.id
    WHERE es.is_test=1 AND es.status<>'cancelled' AND es.work_date BETWEEN @from AND @to${employeeId?" AND es.employee_id=@employeeId":""}
      ${req.user.role==="manager"?"AND es.branch_id=(SELECT TOP 1 branch_id FROM employees WHERE user_id=@userId AND status='working')":""}
    ORDER BY es.work_date,u.full_name;`);
  res.json({success:true,data:result.recordset});
}catch(error){if(error.status)return fail(res,error.status,error.message);next(error)}}

function scenarioTimes(row,input){
  const start=parseWallDateTime(row.shiftStart),end=parseWallDateTime(row.shiftEnd);let checkIn=start,checkOut=end,status="completed";
  if(input.scenario.startsWith("late_"))checkIn=addMinutes(start,Number(input.scenario.split("_")[1]));
  if(input.scenario.startsWith("early_"))checkOut=addMinutes(end,-Number(input.scenario.split("_")[1]));
  if(input.scenario.startsWith("overtime_"))checkOut=addMinutes(end,Number(input.scenario.split("_")[1]));
  if(input.scenario==="missing_checkout"){checkOut=null;status="missing_checkout"}
  if(input.scenario==="absent"){checkIn=null;checkOut=null;status="absent"}
  if(input.scenario==="manual"){
    checkIn=parseWallDateTime(input.checkInTime);checkOut=input.checkOutTime?parseWallDateTime(input.checkOutTime):null;
    if(!checkIn)throw new Error("Giờ vào thủ công không hợp lệ");
    if(checkOut&&checkOut<checkIn)throw new Error("Giờ ra thủ công phải sau giờ vào");
    status=checkOut?"completed":"missing_checkout";
  }
  const worked=checkIn&&checkOut?Math.max(0,Math.round((checkOut-checkIn)/60000)):status==="absent"?0:null;
  const late=checkIn?Math.max(0,Math.floor((checkIn-start)/60000)):0,early=checkOut?Math.max(0,Math.floor((end-checkOut)/60000)):0;
  return {checkIn,checkOut,worked,late,early,status,start};
}

async function generate(req,res,next){
  let tx,started=false;
  try{
    const pool=await sandboxPool(),rows=Array.isArray(req.body.rows)?req.body.rows:[],conflictMode=String(req.body.conflictMode||"skip");
    if(!rows.length||!new Set(["skip","update","replace"]).has(conflictMode))return fail(res,400,"Dữ liệu tạo chấm công không hợp lệ");
    tx=new sql.Transaction(pool);await tx.begin();started=true;let created=0,updated=0,skipped=0;
    for(const input of rows){
      const scheduleId=Number(input.scheduleId);if(!Number.isInteger(scheduleId)||!scenarios.has(input.scenario))throw Object.assign(new Error("Lịch hoặc kịch bản không hợp lệ"),{status:400});
      const schedule=await new sql.Request(tx).input("scheduleId",sql.Int,scheduleId).input("userId",sql.Int,req.user.userId).query(`
        SELECT es.id,es.employee_id AS employeeId,es.branch_id AS branchId,CONVERT(char(10),es.work_date,23) AS workDate,
          CONVERT(char(19),DATEADD(SECOND,DATEDIFF(SECOND,CAST('00:00' AS time),COALESCE(es.start_time_override,s.start_time)),CAST(es.work_date AS datetime2)),126) AS shiftStart,
          CONVERT(char(19),DATEADD(day,CASE WHEN COALESCE(es.end_time_override,s.end_time)<=COALESCE(es.start_time_override,s.start_time) THEN 1 ELSE 0 END,DATEADD(SECOND,DATEDIFF(SECOND,CAST('00:00' AS time),COALESCE(es.end_time_override,s.end_time)),CAST(es.work_date AS datetime2))),126) AS shiftEnd
        FROM employee_schedules es JOIN shifts s ON s.id=es.shift_id WHERE es.id=@scheduleId AND es.is_test=1 AND es.status<>'cancelled'
          AND EXISTS(SELECT 1 FROM schedule_registration_periods rp WHERE rp.branch_id=es.branch_id AND rp.status='published' AND rp.is_test=1 AND es.work_date BETWEEN rp.week_start_date AND rp.week_end_date)
          ${req.user.role==="manager"?"AND es.branch_id=(SELECT TOP 1 branch_id FROM employees WHERE user_id=@userId AND status='working')":""}`);
      const row=schedule.recordset[0];if(!row)throw Object.assign(new Error(`Không tìm thấy lịch Sandbox hợp lệ: ${scheduleId}`),{status:404});
      if(input.employeeId&&Number(input.employeeId)!==Number(row.employeeId))throw Object.assign(new Error("Nhân viên không khớp với lịch"),{status:400});
      const existing=await new sql.Request(tx).input("scheduleId",sql.Int,scheduleId).query("SELECT TOP 1 id,is_test AS isTest FROM attendance_logs WITH(UPDLOCK,HOLDLOCK) WHERE schedule_id=@scheduleId ORDER BY id");
      if(existing.recordset[0]&&!existing.recordset[0].isTest)throw Object.assign(new Error("Từ chối sửa dữ liệu chấm công không phải test"),{status:403});
      if(existing.recordset[0]&&conflictMode==="skip"){skipped++;continue}
      const values=scenarioTimes(row,input),note=`Attendance Test Mode: ${input.scenario}`;
      if(existing.recordset[0]&&conflictMode==="replace")await new sql.Request(tx).input("scheduleId",sql.Int,scheduleId).query("DELETE FROM attendance_logs WHERE schedule_id=@scheduleId AND is_test=1");
      const request=new sql.Request(tx).input("id",sql.BigInt,existing.recordset[0]?.id||null).input("employeeId",sql.Int,row.employeeId).input("scheduleId",sql.Int,scheduleId).input("branchId",sql.Int,row.branchId).input("workDate",sql.Date,row.workDate)
       .input("attendanceTime",sql.DateTime2,values.checkIn||values.start).input("checkIn",sql.DateTime2,values.checkIn).input("checkOut",sql.DateTime2,values.checkOut).input("worked",sql.Int,values.worked).input("late",sql.Int,values.late).input("early",sql.Int,values.early).input("status",sql.VarChar(30),values.status).input("note",sql.NVarChar(255),note).input("userId",sql.Int,req.user.userId);
      if(existing.recordset[0]&&conflictMode==="update"){
        await request.query("UPDATE attendance_logs SET employee_id=@employeeId,branch_id=@branchId,work_date=@workDate,attendance_type='check_in',attendance_time=@attendanceTime,check_in_time=@checkIn,check_out_time=@checkOut,worked_minutes=@worked,late_minutes=@late,early_leave_minutes=@early,status=@status,source='system',note=@note,updated_by=@userId,updated_at=SYSDATETIME() WHERE id=@id AND is_test=1");updated++;
      }else{
        await request.query("INSERT attendance_logs(employee_id,schedule_id,branch_id,work_date,attendance_type,attendance_time,check_in_time,check_out_time,worked_minutes,late_minutes,early_leave_minutes,status,source,note,is_test,updated_by,created_at,updated_at) VALUES(@employeeId,@scheduleId,@branchId,@workDate,'check_in',@attendanceTime,@checkIn,@checkOut,@worked,@late,@early,@status,'system',@note,1,@userId,SYSDATETIME(),SYSDATETIME())");created++;
      }
    }
    await tx.commit();started=false;
    res.status(201).json({success:true,message:`Đã xử lý ${rows.length} lịch kiểm thử`,data:{created,updated,skipped}});
  }catch(error){if(started)await tx.rollback().catch(()=>{});if(error.status)return fail(res,error.status,error.message);next(error)}
}

module.exports={options,schedules,generate,formatWall};
