const {sql,getPool}=require("../config/db");
const {businessNow}=require("../services/businessClockService");
const {employeeFromJwt,eligibility}=require("../services/shiftEligibilityService");
const {record}=require("../services/shiftEventService");
const fail=(res,status,message,data)=>res.status(status).json({success:false,message,data});
const validOperation=value=>["morning","evening"].includes(value);
const executor=tx=>({request:()=>new sql.Request(tx)});

const selectSession=`SELECT ss.id AS shiftSessionId,ss.branch_id AS branchId,b.branch_name AS branchName,CONVERT(char(10),ss.business_date,23) AS businessDate,
 ss.operation_shift_code AS operationShift,ss.leader_employee_id AS leaderEmployeeId,u.full_name AS leaderName,ss.opened_at AS openedAt,
 ss.opening_cash AS openingCash,ss.status,ss.report_submitted_at AS reportSubmittedAt,ss.handed_over_at AS handedOverAt,ss.locked_at AS lockedAt,ss.note
 FROM dbo.shift_sessions ss JOIN dbo.branches b ON b.id=ss.branch_id LEFT JOIN dbo.employees le ON le.id=ss.leader_employee_id LEFT JOIN dbo.users u ON u.id=le.user_id`;

async function current(req,res,next){try{
 const pool=await getPool(),clock=await businessNow(pool),employee=await employeeFromJwt(pool,req.user.userId);
 if(!employee?.employeeId)return fail(res,404,"Không tìm thấy hồ sơ nhân viên");
 const sessions=await pool.request().input("branchId",sql.Int,employee.branchId).input("date",sql.Date,clock.businessDate).query(`${selectSession} WHERE ss.branch_id=@branchId AND ss.business_date=@date AND ss.operation_shift_code IS NOT NULL ORDER BY CASE ss.operation_shift_code WHEN 'morning' THEN 1 ELSE 2 END; SELECT a.operation_shift_code AS operationShift,a.employee_id AS employeeId,u.full_name AS name,a.assignment_role AS assignmentRole FROM operation_shift_assignments a JOIN employees e ON e.id=a.employee_id JOIN users u ON u.id=e.user_id WHERE a.branch_id=@branchId AND a.business_date=@date AND a.status='assigned' AND a.is_test=1`);
 const cards=[];for(const operationShift of ["morning","evening"]){const state=await eligibility(pool,{userId:req.user.userId,businessDate:clock.businessDate,operationShift}),session=sessions.recordsets[0].find(x=>x.operationShift===operationShift)||null;cards.push({operationShift,session,eligibility:{allowed:state.allowed,reasons:state.reasons},leader:session?{employeeId:session.leaderEmployeeId,name:session.leaderName,role:"reporter"}:null})}
 res.json({success:true,data:{businessDateTime:clock.businessDateTime,businessDate:clock.businessDate,branchId:employee.branchId,shifts:cards}});
}catch(error){next(error)}}

async function list(req,res,next){try{const pool=await getPool(),clock=await businessNow(pool),employee=await employeeFromJwt(pool,req.user.userId),date=/^\d{4}-\d{2}-\d{2}$/.test(req.query.date||"")?req.query.date:clock.businessDate,operation=req.query.operationShift;
 const branchId=req.user.role==="employee"?employee?.branchId:Number(req.query.branchId||employee?.branchId);if(!branchId)return fail(res,400,"Chi nhánh không hợp lệ");
 const request=pool.request().input("branchId",sql.Int,branchId).input("date",sql.Date,date);if(operation){if(!validOperation(operation))return fail(res,400,"Ca vận hành không hợp lệ");request.input("operation",sql.VarChar(10),operation)}
 const result=await request.query(`${selectSession} WHERE ss.branch_id=@branchId AND ss.business_date=@date${operation?" AND ss.operation_shift_code=@operation":""} ORDER BY ss.operation_shift_code`);res.json({success:true,data:result.recordset});
}catch(error){next(error)}}

async function detail(req,res,next){try{const pool=await getPool(),employee=await employeeFromJwt(pool,req.user.userId),request=pool.request().input("id",sql.Int,req.params.id);if(req.user.role==="employee")request.input("branchId",sql.Int,employee.branchId);const r=await request.query(`${selectSession} WHERE ss.id=@id${req.user.role==="employee"?" AND ss.branch_id=@branchId":""}`);if(!r.recordset[0])return fail(res,404,"Không tìm thấy phiên ca");res.json({success:true,data:r.recordset[0]})}catch(error){next(error)}}

async function getEligibility(req,res,next){try{const pool=await getPool(),clock=await businessNow(pool),session=await pool.request().input("id",sql.Int,req.params.id).query("SELECT operation_shift_code AS operationShift,business_date AS businessDate FROM dbo.shift_sessions WHERE id=@id");if(!session.recordset[0])return fail(res,404,"Không tìm thấy phiên ca");const state=await eligibility(pool,{userId:req.user.userId,businessDate:session.recordset[0].businessDate,operationShift:session.recordset[0].operationShift});res.json({success:true,data:state})}catch(error){next(error)}}

async function open(req,res,next){const pool=await getPool(),tx=new sql.Transaction(pool);let started=false;try{
 const operationShift=String(req.body.operationShift||"");if(!validOperation(operationShift))return fail(res,400,"Ca vận hành không hợp lệ");await tx.begin();started=true;const ex=executor(tx),clock=await businessNow(ex),state=await eligibility(ex,{userId:req.user.userId,businessDate:clock.businessDate,operationShift});if(!state.allowed){await tx.rollback();started=false;return fail(res,403,"Không đủ điều kiện mở ca",state.reasons)}
 const cash=await ex.request().query("SELECT TRY_CONVERT(decimal(18,2),setting_value) AS amount FROM dbo.system_settings WHERE setting_key='DEFAULT_SHIFT_OPENING_CASH'");const openingCash=Number(cash.recordset[0]?.amount);if(!Number.isFinite(openingCash))throw new Error("Thiếu cấu hình DEFAULT_SHIFT_OPENING_CASH");
 const previous=operationShift==="evening"?await ex.request().input("branchId",sql.Int,state.employee.branchId).input("date",sql.Date,clock.businessDate).query("SELECT TOP 1 status FROM dbo.shift_sessions WHERE branch_id=@branchId AND business_date=@date AND operation_shift_code='morning' AND status NOT IN('cancelled','CANCELLED')"):null;
 if(previous?.recordset[0]&&!['LOCKED'].includes(previous.recordset[0].status)){await tx.rollback();started=false;return fail(res,409,"Ca sáng chưa hoàn tất bàn giao")}
 const result=await ex.request().input("branchId",sql.Int,state.employee.branchId).input("employeeId",sql.Int,state.employee.employeeId).input("scheduleId",sql.Int,state.schedule.scheduleId).input("shiftId",sql.Int,state.schedule.shiftId).input("date",sql.Date,clock.businessDate).input("operation",sql.VarChar(10),operationShift).input("userId",sql.Int,req.user.userId).input("cash",sql.Decimal(18,2),openingCash).input("note",sql.NVarChar(500),String(req.body.note||"").trim()||null).query(`INSERT dbo.shift_sessions(branch_id,employee_id,schedule_id,shift_id,business_date,opening_cash,status,note,operation_shift_code,leader_employee_id,opened_by,is_test,updated_at) OUTPUT INSERTED.id AS shiftSessionId VALUES(@branchId,@employeeId,@scheduleId,@shiftId,@date,@cash,'OPEN',@note,@operation,@employeeId,@userId,1,SYSDATETIME())`);
 const id=result.recordset[0].shiftSessionId;await record(ex,{sessionId:id,branchId:state.employee.branchId,userId:req.user.userId,employeeId:state.employee.employeeId,action:"SHIFT_OPENED",newStatus:"OPEN",payload:{businessDate:clock.businessDate,operationShift,openingCash}});await tx.commit();started=false;res.status(201).json({success:true,message:"Mở ca thành công",data:{shiftSessionId:id,openingCash,businessDate:clock.businessDate,operationShift}});
}catch(error){if(started)await tx.rollback().catch(()=>{});if([2601,2627].includes(error.number))return fail(res,409,"Ca này đã được mở");next(error)}}
module.exports={current,list,detail,getEligibility,open};
