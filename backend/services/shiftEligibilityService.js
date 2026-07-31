const {sql}=require("../config/db");

async function employeeFromJwt(executor,userId){
  const r=await executor.request().input("userId",sql.Int,userId).query(`SELECT TOP 1 e.id AS employeeId,e.branch_id AS branchId,e.status AS employeeStatus,u.status AS userStatus,u.full_name AS fullName
    FROM dbo.users u LEFT JOIN dbo.employees e ON e.user_id=u.id WHERE u.id=@userId`);
  return r.recordset[0]||null;
}

async function eligibility(executor,args){
  const employee=await employeeFromJwt(executor,args.userId),reasons=[];
  if(!employee||employee.userStatus!=="active")reasons.push("Tài khoản không hoạt động");
  if(!employee?.employeeId||employee.employeeStatus!=="working")reasons.push("Hồ sơ nhân viên không hoạt động");
  if(!employee?.employeeId)return {allowed:false,reasons,employee:null};
  const request=executor.request().input("employeeId",sql.Int,employee.employeeId).input("branchId",sql.Int,employee.branchId).input("date",sql.Date,args.businessDate).input("operationShift",sql.VarChar(10),args.operationShift);
  const r=await request.query(`
    SELECT TOP 1 es.id AS scheduleId,es.shift_id AS shiftId FROM dbo.employee_schedules es JOIN dbo.operation_shift_mappings m ON m.branch_id=es.branch_id AND m.shift_id=es.shift_id AND m.is_active=1
    WHERE es.employee_id=@employeeId AND es.branch_id=@branchId AND es.work_date=@date AND es.status<>'cancelled' AND es.is_test=1 AND m.operation_shift_code=@operationShift
      AND EXISTS(SELECT 1 FROM dbo.schedule_registration_periods rp WHERE rp.branch_id=es.branch_id AND rp.status='published' AND rp.is_test=1 AND es.work_date BETWEEN rp.week_start_date AND rp.week_end_date);
    SELECT TOP 1 al.id AS attendanceId FROM dbo.attendance_logs al JOIN dbo.employee_schedules aes ON aes.id=al.schedule_id JOIN dbo.operation_shift_mappings am ON am.branch_id=aes.branch_id AND am.shift_id=aes.shift_id AND am.is_active=1 WHERE al.employee_id=@employeeId AND al.work_date=@date AND al.check_in_time IS NOT NULL AND al.status<>'absent' AND al.is_test=1 AND am.operation_shift_code=@operationShift ORDER BY al.check_in_time;
    SELECT TOP 1 id AS assignmentId,assignment_role AS assignmentRole FROM dbo.operation_shift_assignments WHERE employee_id=@employeeId AND branch_id=@branchId AND business_date=@date AND operation_shift_code=@operationShift AND status='assigned' AND is_test=1;
    SELECT TOP 1 id AS existingSessionId,status AS existingStatus FROM dbo.shift_sessions WHERE branch_id=@branchId AND business_date=@date AND operation_shift_code=@operationShift AND status NOT IN('cancelled','CANCELLED');`);
  const schedule=r.recordsets[0][0],attendance=r.recordsets[1][0],assignment=r.recordsets[2][0],session=r.recordsets[3][0];
  if(!schedule)reasons.push("Không có lịch chính thức đúng ca vận hành");
  if(!attendance)reasons.push("Chưa chấm công vào");
  if(session)reasons.push("Ca này đã được mở");
  return {allowed:reasons.length===0,reasons,employee,schedule,attendance,assignment,session,businessDate:args.businessDate,operationShift:args.operationShift};
}
module.exports={employeeFromJwt,eligibility};
