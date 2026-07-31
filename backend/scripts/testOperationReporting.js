process.env.APP_ENV="sandbox";
require("../config/env").loadEnvironment("sandbox");
const {connect,verifySandbox,sql}=require("./dbTools");
const base="http://localhost:5001/api",password="Test@123456";
async function login(email){const response=await fetch(`${base}/auth/login`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({email,password})});const body=await response.json();if(!response.ok)throw new Error(body.message||`Login ${email} thất bại`);return body.token}
async function call(token,path,method="GET",body){const response=await fetch(`${base}${path}`,{method,headers:{authorization:`Bearer ${token}`,"content-type":"application/json"},body:body?JSON.stringify(body):undefined});return {status:response.status,body:await response.json()}}
(async()=>{
  const pool=await connect();await verifySandbox(pool);let sessionId=null;
  try{
    const people=await pool.request().query(`SELECT TOP 1 e.id employeeId,e.branch_id branchId,es.id scheduleId,es.shift_id shiftId FROM employees e JOIN users u ON u.id=e.user_id JOIN employee_schedules es ON es.employee_id=e.id WHERE u.email='test.employee01@daiga.test' AND e.is_test=1 ORDER BY es.id;
      SELECT TOP 1 e.id employeeId FROM employees e JOIN users u ON u.id=e.user_id WHERE u.email='test.employee02@daiga.test' AND e.is_test=1`);
    const leader=people.recordsets[0][0];if(!leader)throw new Error("Thiếu Employee01 hoặc lịch Sandbox");
    const inserted=await pool.request().input("branch",sql.Int,leader.branchId).input("employee",sql.Int,leader.employeeId).input("schedule",sql.Int,leader.scheduleId).input("shift",sql.Int,leader.shiftId)
      .query(`INSERT shift_sessions(branch_id,employee_id,schedule_id,shift_id,business_date,opening_cash,status,operation_shift_code,leader_employee_id,is_test,updated_at)
        OUTPUT INSERTED.id VALUES(@branch,@employee,@schedule,@shift,'2099-12-31',1000000,'OPEN','morning',@employee,1,SYSDATETIME())`);
    sessionId=inserted.recordset[0].id;
    const leaderToken=await login("test.employee01@daiga.test"),viewerToken=await login("test.employee02@daiga.test");
    const draftPayload={cashRevenue:2000000,transferRevenue:500000,ewalletRevenue:300000,deliveryRevenue:200000,note:"Bản kiểm thử Giai đoạn 2",denominations:{500000:5,200000:2,100000:1}};
    const viewerRead=await call(viewerToken,`/operations/shifts/${sessionId}/report`);
    const viewerWrite=await call(viewerToken,`/operations/shifts/${sessionId}/report`,"PUT",draftPayload);
    const draft=await call(leaderToken,`/operations/shifts/${sessionId}/report`,"PUT",draftPayload);
    const readDraft=await call(leaderToken,`/operations/shifts/${sessionId}/report`);
    const submit=await call(leaderToken,`/operations/shifts/${sessionId}/report/submit`,"POST",draftPayload);
    const database=await pool.request().input("id",sql.Int,sessionId).query(`SELECT ss.status,r.status reportStatus,r.total_revenue totalRevenue,r.expected_cash expectedCash,r.actual_cash actualCash,r.difference_amount differenceAmount,r.cash_to_deposit cashToDeposit,
      (SELECT COUNT(*) FROM shift_cash_denominations d WHERE d.shift_closing_report_id=r.id AND d.is_test=1) denominationRows,
      (SELECT COUNT(*) FROM shift_operation_audit_logs a WHERE a.shift_session_id=ss.id AND a.action='REPORT_SUBMITTED' AND a.is_test=1) audits,
      (SELECT COUNT(*) FROM business_events e WHERE e.entity_id=ss.id AND e.event_type='SHIFT_REPORT_SUBMITTED' AND e.is_test=1) events
      FROM shift_sessions ss JOIN shift_closing_reports r ON r.shift_session_id=ss.id WHERE ss.id=@id`);
    const row=database.recordset[0]||{};
    const checks={viewerCanRead:viewerRead.status===200,viewerCannotEdit:viewerWrite.status===403,draftSaved:[200,201].includes(draft.status),draftReadable:readDraft.body.data?.report?.status==="draft",submitted:submit.status===200,stateWaiting:row.status==="WAITING_HANDOVER",reportSubmitted:row.reportStatus==="submitted",totalRevenue:Number(row.totalRevenue)===3000000,expectedCash:Number(row.expectedCash)===3000000,actualCash:Number(row.actualCash)===3000000,differenceZero:Number(row.differenceAmount)===0,cashToDeposit:Number(row.cashToDeposit)===2000000,denominationsSaved:Number(row.denominationRows)===9,auditCreated:Number(row.audits)===1,eventCreated:Number(row.events)===1};
    console.log(JSON.stringify({checks,calculated:row,responses:{viewerRead,viewerWrite,draft,readDraft,submit}},null,2));if(Object.values(checks).some(value=>!value))process.exitCode=1;
  }finally{
    if(sessionId){await pool.request().input("id",sql.Int,sessionId).query(`DELETE FROM business_events WHERE entity_type='shift_session' AND entity_id=@id AND is_test=1;DELETE FROM shift_operation_audit_logs WHERE shift_session_id=@id AND is_test=1;DELETE FROM shift_cash_denominations WHERE shift_closing_report_id IN(SELECT id FROM shift_closing_reports WHERE shift_session_id=@id AND is_test=1);DELETE FROM shift_closing_reports WHERE shift_session_id=@id AND is_test=1;DELETE FROM shift_sessions WHERE id=@id AND is_test=1;`)}
    await pool.close();
  }
})().catch(error=>{console.error(error);process.exit(1)});
