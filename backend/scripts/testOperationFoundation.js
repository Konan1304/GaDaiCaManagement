process.env.APP_ENV="sandbox";require("../config/env").loadEnvironment("sandbox");const {connect,verifySandbox,sql}=require("./dbTools");
const base="http://localhost:5001/api";const password="Test@123456";
async function login(email){const r=await fetch(`${base}/auth/login`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({email,password})});return (await r.json()).token}
async function call(token,path,method="GET",body){const r=await fetch(`${base}${path}`,{method,headers:{authorization:`Bearer ${token}`,"content-type":"application/json"},body:body?JSON.stringify(body):undefined});return {status:r.status,body:await r.json()}}
(async()=>{const pool=await connect();await verifySandbox(pool);const admin=await login("test.admin@daiga.test"),employee1=await login("test.employee01@daiga.test"),employee2=await login("test.employee02@daiga.test"),employee3=await login("test.employee03@daiga.test"),employee4=await login("test.employee04@daiga.test"),manager=await login("test.manager@daiga.test");
 try{
  await pool.request().query("DELETE FROM business_events WHERE is_test=1 AND entity_type='shift_session'; DELETE FROM shift_operation_audit_logs WHERE is_test=1; DELETE FROM shift_sessions WHERE is_test=1 AND operation_shift_code IS NOT NULL;");
  const attendance=await pool.request().input("employeeId",sql.Int,9).input("date",sql.Date,"2026-06-01").query("SELECT id,check_in_time FROM attendance_logs WHERE employee_id=@employeeId AND work_date=@date AND is_test=1");
  if(attendance.recordset[0])await pool.request().input("id",sql.BigInt,attendance.recordset[0].id).query("UPDATE attendance_logs SET check_in_time=NULL WHERE id=@id");
  const noSchedule=await call(employee3,"/operations/shifts/open","POST",{operationShift:"morning"});
  const noAttendance=await call(employee4,"/operations/shifts/open","POST",{operationShift:"morning"});
  if(attendance.recordset[0])await pool.request().input("id",sql.BigInt,attendance.recordset[0].id).input("value",sql.DateTime2,attendance.recordset[0].check_in_time).query("UPDATE attendance_logs SET check_in_time=@value WHERE id=@id");
  const notLeader=await call(employee2,"/operations/shifts/open","POST",{operationShift:"morning"});
  const wrongShift=await call(employee1,"/operations/shifts/open","POST",{operationShift:"evening"});
  const unassignedManager=await call(manager,"/operations/shifts/open","POST",{operationShift:"morning"});
  const concurrent=await Promise.all([call(employee1,"/operations/shifts/open","POST",{operationShift:"morning",employeeId:999999}),call(employee1,"/operations/shifts/open","POST",{operationShift:"morning"})]);
  const session=await pool.request().query("SELECT TOP 1 id FROM shift_sessions WHERE is_test=1 AND operation_shift_code='morning' ORDER BY id DESC");const id=session.recordset[0].id;
  await pool.request().input("id",sql.Int,id).query("UPDATE shift_sessions SET status='LOCKED',locked_at=SYSDATETIME() WHERE id=@id");
  const unlockWithoutReason=await call(admin,`/manager/operations/shifts/${id}/unlock`,"POST",{reason:""}),unlockWithReason=await call(admin,`/manager/operations/shifts/${id}/unlock`,"POST",{reason:"Kiểm thử mở khóa hợp lệ"});
  const checks={noSchedule:noSchedule.status===403,noAttendance:noAttendance.status===403,notLeader:notLeader.status===403,leaderWrongShift:wrongShift.status===403,managerUnassigned:unassignedManager.status===403,fakeEmployeeIgnored:concurrent.some(x=>x.status===201),onlyOneConcurrentSuccess:concurrent.filter(x=>x.status===201).length===1,unlockRequiresReason:unlockWithoutReason.status===400,unlockSuccess:unlockWithReason.status===200};
  const counts=await pool.request().query("SELECT (SELECT COUNT(*) FROM shift_operation_audit_logs WHERE is_test=1) audits,(SELECT COUNT(*) FROM business_events WHERE is_test=1) events");checks.auditCreated=Number(counts.recordset[0].audits)>=2;checks.outboxCreated=Number(counts.recordset[0].events)>=2;console.log(JSON.stringify({checks,details:{noSchedule:noSchedule.body,noAttendance:noAttendance.body,concurrent:concurrent.map(x=>x.status),unlockWithoutReason:unlockWithoutReason.body,unlockWithReason:unlockWithReason.body}},null,2));if(Object.values(checks).some(x=>!x))process.exitCode=1;await pool.request().query("DELETE FROM business_events WHERE is_test=1 AND entity_type='shift_session'; DELETE FROM shift_operation_audit_logs WHERE is_test=1; DELETE FROM shift_sessions WHERE is_test=1 AND operation_shift_code IS NOT NULL;");
 }finally{await pool.close()}
})().catch(e=>{console.error(e);process.exit(1)});
