const {sql}=require("../config/db");

async function employeeFromJwt(executor,userId){
  const r=await executor.request().input("userId",sql.Int,userId).query(`SELECT TOP 1 e.id AS employeeId,e.branch_id AS branchId,e.status AS employeeStatus,u.status AS userStatus,u.full_name AS fullName
    FROM dbo.users u LEFT JOIN dbo.employees e ON e.user_id=u.id WHERE u.id=@userId`);
  return r.recordset[0]||null;
}

function operationSchedulePredicate(scheduleAlias,shiftAlias){
  const code=`UPPER(REPLACE(REPLACE(COALESCE(${scheduleAlias}.display_code,${shiftAlias}.shift_code),' ',''),'+',''))`;
  const start=`COALESCE(${scheduleAlias}.start_time_override,${shiftAlias}.start_time)`;
  const end=`COALESCE(${scheduleAlias}.end_time_override,${shiftAlias}.end_time)`;
  const startMinute=`DATEDIFF(MINUTE,CAST('00:00' AS time),${start})`;
  const endMinute=`DATEDIFF(MINUTE,CAST('00:00' AS time),${end})+CASE WHEN ${end}<=${start} THEN 1440 ELSE 0 END`;
  const fullDay=`(${code} LIKE '%FULL%' OR ${code} IN('AB','BA') OR ((${endMinute})-(${startMinute})>=600 AND ${startMinute}<960 AND ${endMinute}>960))`;
  return `((${fullDay}) OR (@operationShift='morning' AND ${shiftAlias}.shift_code IN('A','P1','P2')) OR (@operationShift='evening' AND ${shiftAlias}.shift_code IN('B','P3')))`;
}

async function eligibility(executor,args){
  const employee=await employeeFromJwt(executor,args.userId),reasons=[];
  if(!employee||employee.userStatus!=="active")reasons.push("Tài khoản không hoạt động");
  if(!employee?.employeeId||employee.employeeStatus!=="working")reasons.push("Hồ sơ nhân viên không hoạt động");
  if(!employee?.employeeId)return {allowed:false,reasons,employee:null};
  const isTest = process.env.APP_ENV === "sandbox" ? 1 : 0;
  const request=executor.request().input("employeeId",sql.Int,employee.employeeId).input("branchId",sql.Int,employee.branchId).input("date",sql.Date,args.businessDate).input("operationShift",sql.VarChar(10),args.operationShift).input("isTest",sql.Bit,isTest);
  const scheduleOperation=operationSchedulePredicate("es","s"),attendanceOperation=operationSchedulePredicate("aes","ats");
  const r=await request.query(`
    SELECT TOP 1 es.id AS scheduleId,es.shift_id AS shiftId FROM dbo.employee_schedules es JOIN dbo.shifts s ON s.id=es.shift_id
    WHERE es.employee_id=@employeeId AND es.branch_id=@branchId AND es.work_date=@date AND es.status<>'cancelled' AND (es.is_test=@isTest OR (es.is_test=0 AND @isTest=1))
      AND ${scheduleOperation}
      AND EXISTS(SELECT 1 FROM dbo.schedule_registration_periods rp WHERE rp.branch_id=es.branch_id AND rp.status='published' AND (rp.is_test=@isTest OR (rp.is_test=0 AND @isTest=1)) AND es.work_date BETWEEN rp.week_start_date AND rp.week_end_date);
    SELECT TOP 1 al.id AS attendanceId FROM dbo.attendance_logs al JOIN dbo.employee_schedules aes ON aes.id=al.schedule_id JOIN dbo.shifts ats ON ats.id=aes.shift_id
    WHERE al.employee_id=@employeeId AND al.work_date=@date AND al.check_in_time IS NOT NULL AND al.status<>'absent' AND (al.is_test=@isTest OR (al.is_test=0 AND @isTest=1))
      AND ${attendanceOperation} ORDER BY al.check_in_time;
    SELECT TOP 1 id AS assignmentId,assignment_role AS assignmentRole FROM dbo.operation_shift_assignments WHERE employee_id=@employeeId AND branch_id=@branchId AND business_date=@date AND operation_shift_code=@operationShift AND status='assigned' AND is_test=@isTest;
    SELECT TOP 1 id AS existingSessionId,status AS existingStatus FROM dbo.shift_sessions WHERE branch_id=@branchId AND business_date=@date AND operation_shift_code=@operationShift AND is_test=@isTest AND status NOT IN('cancelled','CANCELLED');`);
  const schedule=r.recordsets[0][0],attendance=r.recordsets[1][0],assignment=r.recordsets[2][0],session=r.recordsets[3][0];
  if(!schedule)reasons.push("Bạn không có lịch chính thức trong ca này");
  if(!attendance)reasons.push("Chưa chấm công vào");
  if(session)reasons.push("Ca này đã được mở");
  return {allowed:reasons.length===0,reasons,employee,schedule,attendance,assignment,session,businessDate:args.businessDate,operationShift:args.operationShift};
}
module.exports={employeeFromJwt,eligibility};
