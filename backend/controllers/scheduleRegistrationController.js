const {sql,getPool}=require("../config/db");
const validDate=v=>/^\d{4}-\d{2}-\d{2}$/.test(String(v||""));
const fail=(res,status,message)=>res.status(status).json({success:false,message});
const scheduleTestMode=process.env.NODE_ENV!=="production"&&String(process.env.ENABLE_SCHEDULE_TEST_MODE).toLowerCase()==="true";
const vietnamNow=()=>new Date(new Date().toLocaleString("en-US",{timeZone:"Asia/Ho_Chi_Minh"}));
const dateTimeLocal=value=>new Date(String(value||""));
const generatedTitle=(start,end)=>{
  const format=value=>{const [year,month,day]=value.split("-");return `${day}/${month}`};
  return `Đăng ký lịch ${format(start)} - ${format(end)}`;
};
const periodSelect=`SELECT p.id AS periodId,p.branch_id AS branchId,b.branch_code AS branchCode,b.branch_name AS branchName,
 p.title,p.week_start_date AS weekStartDate,p.week_end_date AS weekEndDate,
 CONVERT(varchar(19),p.registration_open_at,126) AS registrationOpenAt,
 CONVERT(varchar(19),p.registration_close_at,126) AS registrationCloseAt,p.status,p.is_test AS isTest,p.note,p.created_at AS createdAt,
 (SELECT COUNT(DISTINCT r.employee_id) FROM employee_shift_registrations r WHERE r.period_id=p.id) AS registeredEmployees,
 (SELECT COUNT(*) FROM employees e WHERE e.branch_id=p.branch_id AND e.status='working') AS totalEmployees
 FROM schedule_registration_periods p INNER JOIN branches b ON b.id=p.branch_id`;
const shiftSelect=`SELECT id AS shiftId,shift_code AS shiftCode,shift_name AS shiftName,start_time AS startTime,end_time AS endTime,shift_type AS shiftType FROM shifts WHERE status='active' AND shift_code IN ('A','B','P1','P2','P3') ORDER BY start_time`;
async function employeeFor(pool,userId,workingOnly=true){const r=await pool.request().input("userId",sql.Int,userId).query(`SELECT e.id AS employeeId,e.branch_id AS branchId,e.status AS employeeStatus,u.status AS accountStatus FROM employees e JOIN users u ON u.id=e.user_id WHERE e.user_id=@userId${workingOnly?" AND e.status='working' AND u.status='active'":""}`);return r.recordset[0]}
function checkWeek(start,end){if(!validDate(start)||!validDate(end))return false;const a=new Date(`${start}T00:00:00Z`),b=new Date(`${end}T00:00:00Z`);return b>=a&&(b-a)/864e5<=31}
function validatePeriodInput(body){
  body.weekStartDate=body.weekStartDate||body.startDate;
  body.weekEndDate=body.weekEndDate||body.endDate;
  if(!Number.isInteger(Number(body.branchId))||Number(body.branchId)<=0)return "Vui lòng chọn chi nhánh.";
  if(!validDate(body.weekStartDate))return "Vui lòng chọn ngày bắt đầu.";
  if(!validDate(body.weekEndDate))return "Vui lòng chọn ngày kết thúc.";
  const start=new Date(`${body.weekStartDate}T00:00:00Z`),end=new Date(`${body.weekEndDate}T00:00:00Z`);
  if(end<start)return "Ngày kết thúc phải từ ngày bắt đầu trở đi.";
  if((end-start)/864e5>31)return "Khoảng ngày đăng ký không được dài quá 32 ngày.";
  const today=new Date(vietnamNow());today.setHours(0,0,0,0);
  if(!scheduleTestMode&&new Date(`${body.weekStartDate}T00:00:00`)<today)return "Không thể tạo đợt có ngày bắt đầu trong quá khứ.";
  body.title=String(body.title||"").trim()||generatedTitle(body.weekStartDate,body.weekEndDate);
  const customOpen=Boolean(body.registrationOpenAt),customClose=Boolean(body.registrationCloseAt);
  if(customOpen!==customClose)return "Vui lòng nhập đầy đủ thời gian mở và đóng đăng ký.";
  if(customOpen){
    const open=dateTimeLocal(body.registrationOpenAt),close=dateTimeLocal(body.registrationCloseAt);
    if(Number.isNaN(open.getTime())||Number.isNaN(close.getTime())||close<=open)return "Thời gian đóng đăng ký không hợp lệ.";
    if(close>new Date(`${body.weekStartDate}T23:59:59`))return "Thời gian đóng đăng ký phải trước ngày bắt đầu làm việc.";
  }else{
    const close=new Date(`${body.weekStartDate}T00:00:00`);
    close.setMinutes(close.getMinutes()-1);
    if(close<=vietnamNow()){
      if(!scheduleTestMode)return "Ngày bắt đầu quá gần. Hãy chọn từ ngày mai trở đi hoặc tùy chỉnh thời gian đăng ký.";
      close.setTime(vietnamNow().getTime()+24*60*60*1000);
    }
    const pad=value=>String(value).padStart(2,"0");
    const local=value=>`${value.getFullYear()}-${pad(value.getMonth()+1)}-${pad(value.getDate())}T${pad(value.getHours())}:${pad(value.getMinutes())}:${pad(value.getSeconds())}`;
    body.registrationOpenAt=local(vietnamNow());
    body.registrationCloseAt=local(close);
  }
  return null;
}

async function current(req,res,next){try{const pool=await getPool(),employee=await employeeFor(pool,req.user.userId,false);if(!employee)return res.json({success:true,data:null});const result=await pool.request().input("branchId",sql.Int,employee.branchId).input("employeeId",sql.Int,employee.employeeId).input("testMode",sql.Bit,scheduleTestMode).query(`
 ${periodSelect} WHERE p.branch_id=@branchId AND p.status IN ('open','locked','published') AND (p.is_test=0 OR @testMode=1) ORDER BY CASE p.status WHEN 'open' THEN 0 WHEN 'locked' THEN 1 ELSE 2 END,p.week_start_date DESC;
 ${shiftSelect};
 SELECT r.id,r.period_id AS periodId,r.work_date AS workDate,s.shift_code AS shiftCode,r.preference_level AS preferenceLevel,r.note
 FROM employee_shift_registrations r JOIN shifts s ON s.id=r.shift_id WHERE r.employee_id=@employeeId;
 SELECT CONVERT(varchar(19),SYSDATETIME(),126) AS serverTime;`);
 const period=result.recordsets[0][0];if(!period){console.info(`[shift-registration] user=${req.user.userId}, employee=${employee.employeeId}, branch=${employee.branchId}: không có period phù hợp`);return res.json({success:true,data:null})}const serverTime=result.recordsets[3][0].serverTime;
 period.startDate=period.weekStartDate;period.endDate=period.weekEndDate;period.serverTime=serverTime;period.canRegister=period.status==="open"&&(period.isTest&&scheduleTestMode||new Date(serverTime)>=new Date(period.registrationOpenAt)&&new Date(serverTime)<=new Date(period.registrationCloseAt))&&employee.employeeStatus==="working"&&employee.accountStatus==="active";period.shifts=result.recordsets[1];period.existingRegistrations=result.recordsets[2].filter(x=>Number(x.periodId)===Number(period.periodId));res.json({success:true,data:period});
}catch(error){next(error)}}

async function saveEmployee(req,res,next){const pool=await getPool(),tx=new sql.Transaction(pool);let started=false;try{const employee=await employeeFor(pool,req.user.userId);if(!employee)return fail(res,403,"Nhân viên không ở trạng thái làm việc");const registrations=Array.isArray(req.body.registrations)?req.body.registrations:[];await tx.begin();started=true;const periodResult=await new sql.Request(tx).input("id",sql.Int,req.params.periodId).query("SELECT * FROM schedule_registration_periods WITH(UPDLOCK) WHERE id=@id");const p=periodResult.recordset[0];if(!p){await tx.rollback();started=false;return fail(res,404,"Không tìm thấy đợt đăng ký")}if(Number(p.branch_id)!==Number(employee.branchId)){await tx.rollback();started=false;return fail(res,403,"Đợt đăng ký không thuộc chi nhánh của bạn")}const now=new Date();if(p.status!=="open"||(!(p.is_test&&scheduleTestMode)&&(now<new Date(p.registration_open_at)||now>new Date(p.registration_close_at)))){await tx.rollback();started=false;return fail(res,409,"Đợt đăng ký ca đã được khóa")}
 if(p.is_test&&!scheduleTestMode){await tx.rollback();started=false;return fail(res,403,"Dữ liệu kiểm thử đã bị vô hiệu hóa")}
 const codes=[...new Set(registrations.map(x=>String(x.shiftCode||"").toUpperCase()))];const shifts=codes.length?await new sql.Request(tx).query(`${shiftSelect}`):{recordset:[]};const byCode=new Map(shifts.recordset.map(x=>[x.shiftCode,x]));for(const item of registrations){if(!validDate(item.workDate)||item.workDate<new Date(p.week_start_date).toISOString().slice(0,10)||item.workDate>new Date(p.week_end_date).toISOString().slice(0,10)||!byCode.has(String(item.shiftCode).toUpperCase())){await tx.rollback();started=false;return fail(res,400,"Ngày hoặc ca đăng ký không hợp lệ")}}
 await new sql.Request(tx).input("periodId",sql.Int,p.id).input("employeeId",sql.Int,employee.employeeId).query("DELETE FROM employee_shift_registrations WHERE period_id=@periodId AND employee_id=@employeeId");
 for(const item of registrations){const shift=byCode.get(String(item.shiftCode).toUpperCase());await new sql.Request(tx).input("periodId",sql.Int,p.id).input("employeeId",sql.Int,employee.employeeId).input("date",sql.Date,item.workDate).input("shiftId",sql.Int,shift.shiftId).input("preference",sql.VarChar(20),item.preferenceLevel==="preferred"?"preferred":"available").input("note",sql.NVarChar(500),req.body.note||item.note||null).query("INSERT INTO employee_shift_registrations(period_id,employee_id,work_date,shift_id,preference_level,note) VALUES(@periodId,@employeeId,@date,@shiftId,@preference,@note)")}
 await tx.commit();started=false;const result=await pool.request().input("periodId",sql.Int,p.id).input("employeeId",sql.Int,employee.employeeId).query("SELECT r.id,r.work_date AS workDate,s.shift_code AS shiftCode,r.preference_level AS preferenceLevel,r.note FROM employee_shift_registrations r JOIN shifts s ON s.id=r.shift_id WHERE r.period_id=@periodId AND r.employee_id=@employeeId ORDER BY r.work_date");res.json({success:true,message:"Lưu đăng ký ca thành công",data:result.recordset});
}catch(error){if(started)await tx.rollback().catch(()=>{});next(error)}}
async function saveEmployeeCurrent(req,res,next){try{const pool=await getPool(),employee=await employeeFor(pool,req.user.userId);if(!employee)return fail(res,403,"Nhân viên không ở trạng thái làm việc");const r=await pool.request().input("branchId",sql.Int,employee.branchId).query("SELECT TOP 1 id FROM schedule_registration_periods WHERE branch_id=@branchId AND status='open' ORDER BY created_at DESC");if(!r.recordset[0])return fail(res,404,"Hiện chưa có đợt đăng ký ca");req.params.periodId=r.recordset[0].id;return saveEmployee(req,res,next)}catch(error){next(error)}}

async function periods(req,res,next){try{const result=await (await getPool()).request().query(`${periodSelect} ORDER BY p.week_start_date DESC,p.created_at DESC`);res.json({success:true,data:result.recordset})}catch(error){next(error)}}
async function periodsScoped(req,res,next){try{if(!req.managerBranchId)return periods(req,res,next);const result=await (await getPool()).request().input("branchId",sql.Int,req.managerBranchId).query(`${periodSelect} WHERE p.branch_id=@branchId ORDER BY p.week_start_date DESC,p.created_at DESC`);res.json({success:true,data:result.recordset})}catch(error){next(error)}}
async function managerScope(req,res,next){try{if(req.user.role==="admin")return next();const pool=await getPool(),employee=await employeeFor(pool,req.user.userId,false);if(!employee)return fail(res,403,"Tài khoản quản lý chưa được gán chi nhánh");req.managerBranchId=Number(employee.branchId);if(req.body.branchId&&Number(req.body.branchId)!==req.managerBranchId)return fail(res,403,"Bạn chỉ được quản lý chi nhánh của mình");const match=req.originalUrl.match(/(?:periods|shift-registration|schedule-builder)\/(\d+)/),periodId=Number(req.body.periodId||req.query.periodId||(match&&match[1]));if(periodId){const p=await pool.request().input("id",sql.Int,periodId).query("SELECT branch_id AS branchId FROM schedule_registration_periods WHERE id=@id");if(p.recordset[0]&&Number(p.recordset[0].branchId)!==req.managerBranchId)return fail(res,403,"Đợt đăng ký không thuộc chi nhánh của bạn")}return next()}catch(error){next(error)}}
async function periodDetail(req,res,next){try{const pool=await getPool(),id=req.params.id;const result=await pool.request().input("id",sql.Int,id).query(`${periodSelect} WHERE p.id=@id; ${shiftSelect}; SELECT e.id AS employeeId,e.employee_code AS employeeCode,u.full_name AS fullName,p.position_name AS positionName,e.position_id AS positionId,r.work_date AS workDate,s.shift_code AS shiftCode,r.preference_level AS preferenceLevel,r.note FROM schedule_registration_periods rp JOIN employees e ON e.branch_id=rp.branch_id AND e.status='working' JOIN users u ON u.id=e.user_id JOIN positions p ON p.id=e.position_id LEFT JOIN employee_shift_registrations r ON r.period_id=rp.id AND r.employee_id=e.id LEFT JOIN shifts s ON s.id=r.shift_id WHERE rp.id=@id ORDER BY u.full_name,r.work_date; SELECT es.employee_id AS employeeId,es.work_date AS workDate,s.shift_code AS shiftCode,es.work_position AS workPosition,es.note FROM employee_schedules es JOIN shifts s ON s.id=es.shift_id JOIN schedule_registration_periods rp ON rp.branch_id=es.branch_id AND es.work_date BETWEEN rp.week_start_date AND rp.week_end_date WHERE rp.id=@id;`);if(!result.recordsets[0][0])return fail(res,404,"Không tìm thấy đợt đăng ký");res.json({success:true,data:{period:result.recordsets[0][0],shifts:result.recordsets[1],rows:result.recordsets[2],currentSchedules:result.recordsets[3]}})}catch(error){next(error)}}
async function createPeriod(req,res,next){try{const b=req.body;if(!checkWeek(b.weekStartDate,b.weekEndDate)||!b.title||!b.branchId||!b.registrationOpenAt||!b.registrationCloseAt)return fail(res,400,"Thông tin đợt đăng ký không hợp lệ");const result=await (await getPool()).request().input("branchId",sql.Int,b.branchId).input("title",sql.NVarChar(200),b.title.trim()).input("start",sql.Date,b.weekStartDate).input("end",sql.Date,b.weekEndDate).input("openAt",sql.DateTime2,b.registrationOpenAt).input("closeAt",sql.DateTime2,b.registrationCloseAt).input("isTest",sql.Bit,scheduleTestMode).input("createdBy",sql.Int,req.user.userId).input("note",sql.NVarChar(1000),b.note||null).query(`
IF EXISTS(SELECT 1 FROM schedule_registration_periods WHERE branch_id=@branchId AND status<>'cancelled'
  AND week_start_date<=@end AND week_end_date>=@start)
  THROW 50002,N'Khoảng ngày này đã có đợt đăng ký.',1;
INSERT INTO schedule_registration_periods(branch_id,title,week_start_date,week_end_date,registration_open_at,registration_close_at,status,is_test,created_by,note)
OUTPUT INSERTED.id AS periodId,INSERTED.status
VALUES(@branchId,@title,@start,@end,@openAt,@closeAt,'open',@isTest,@createdBy,@note)`);const created=result.recordset[0];res.status(201).json({success:true,message:scheduleTestMode?"Đã tạo đợt đăng ký kiểm thử.":"Đã tạo và mở đợt đăng ký lịch.",data:created})}catch(error){if(error.number===50002)return fail(res,409,"Khoảng ngày này đã có đợt đăng ký.");next(error)}}
async function updatePeriod(req,res,next){try{const b=req.body;if(!checkWeek(b.weekStartDate,b.weekEndDate))return fail(res,400,"Tuần làm việc phải từ Thứ Hai đến Chủ nhật");const result=await (await getPool()).request().input("id",sql.Int,req.params.id).input("branchId",sql.Int,b.branchId).input("title",sql.NVarChar(200),b.title).input("start",sql.Date,b.weekStartDate).input("end",sql.Date,b.weekEndDate).input("openAt",sql.DateTime2,b.registrationOpenAt).input("closeAt",sql.DateTime2,b.registrationCloseAt).input("note",sql.NVarChar(1000),b.note||null).query("UPDATE schedule_registration_periods SET branch_id=@branchId,title=@title,week_start_date=@start,week_end_date=@end,registration_open_at=@openAt,registration_close_at=@closeAt,note=@note,updated_at=SYSDATETIME() OUTPUT INSERTED.id WHERE id=@id AND status='draft'");if(!result.recordset[0])return fail(res,409,"Chỉ có thể sửa đợt ở trạng thái nháp");res.json({success:true,message:"Cập nhật đợt thành công"})}catch(error){next(error)}}
async function transition(req,res,next){try{const action=req.params.action,allowed={open:["draft","open","locked","published"],lock:["open","locked","published"],cancel:["draft","open","locked","cancelled"]};if(!allowed[action])return fail(res,400,"Thao tác không hợp lệ");const target={open:"open",lock:"locked",cancel:"cancelled"}[action],pool=await getPool();const result=await pool.request().input("id",sql.Int,req.params.id).input("userId",sql.Int,req.user.userId).input("target",sql.VarChar(20),target).query(`UPDATE schedule_registration_periods SET
status=@target,
registration_open_at=CASE WHEN @target='open' AND registration_open_at>SYSDATETIME() THEN SYSDATETIME() ELSE registration_open_at END,
registration_close_at=CASE WHEN @target='open' AND registration_close_at<=SYSDATETIME() THEN DATEADD(day,1,SYSDATETIME()) ELSE registration_close_at END,
locked_by=CASE WHEN @target='locked' THEN @userId WHEN @target='open' THEN NULL ELSE locked_by END,
locked_at=CASE WHEN @target='locked' THEN SYSDATETIME() WHEN @target='open' THEN NULL ELSE locked_at END,
updated_at=SYSDATETIME()
OUTPUT INSERTED.id,INSERTED.status,INSERTED.registration_open_at AS registrationOpenAt,INSERTED.registration_close_at AS registrationCloseAt
WHERE id=@id`);if(!result.recordset[0])return fail(res,404,"Không tìm thấy đợt đăng ký");res.json({success:true,message:target==="open"?"Đã mở đăng ký cho nhân viên":target==="locked"?"Đã khóa đăng ký":"Đã hủy đợt đăng ký",data:result.recordset[0]})}catch(error){next(error)}}

async function validateCreatePeriod(req,res,next){try{const message=validatePeriodInput(req.body);if(message)return fail(res,400,message);const result=await (await getPool()).request().input("branchId",sql.Int,req.body.branchId).query("SELECT id FROM branches WHERE id=@branchId AND status='active'");if(!result.recordset[0])return fail(res,400,"Chi nhánh không hợp lệ");return next()}catch(error){next(error)}}
async function deletePeriod(req,res,next){const pool=await getPool(),tx=new sql.Transaction(pool);let started=false;try{await tx.begin();started=true;const p=await new sql.Request(tx).input("id",sql.Int,req.params.id).query("SELECT status FROM schedule_registration_periods WITH(UPDLOCK) WHERE id=@id");if(!p.recordset[0]){await tx.rollback();started=false;return fail(res,404,"Không tìm thấy đợt đăng ký")}if(!["draft","cancelled"].includes(p.recordset[0].status)){await tx.rollback();started=false;return fail(res,409,"Chỉ có thể xóa đợt nháp hoặc đã hủy")}await new sql.Request(tx).input("id",sql.Int,req.params.id).query("DELETE FROM schedule_draft_assignments WHERE period_id=@id; DELETE FROM employee_shift_registrations WHERE period_id=@id; DELETE FROM schedule_registration_periods WHERE id=@id;");await tx.commit();started=false;res.json({success:true,message:"Đã xóa đợt đăng ký"})}catch(error){if(started)await tx.rollback().catch(()=>{});next(error)}}
async function deletePeriodAny(req,res,next){const pool=await getPool(),tx=new sql.Transaction(pool);let started=false;try{await tx.begin();started=true;const p=await new sql.Request(tx).input("id",sql.Int,req.params.id).query("SELECT id FROM schedule_registration_periods WITH(UPDLOCK) WHERE id=@id");if(!p.recordset[0]){await tx.rollback();started=false;return fail(res,404,"Không tìm thấy đợt đăng ký")}await new sql.Request(tx).input("id",sql.Int,req.params.id).query("DELETE FROM schedule_draft_assignments WHERE period_id=@id; DELETE FROM employee_shift_registrations WHERE period_id=@id; DELETE FROM schedule_registration_periods WHERE id=@id;");await tx.commit();started=false;res.json({success:true,message:"Đã xóa đợt đăng ký. Lịch chính thức đã công bố được giữ nguyên."})}catch(error){if(started)await tx.rollback().catch(()=>{});next(error)}}
async function builderGetDraft(req,res,next){try{const pool=await getPool(),id=req.params.periodId;const result=await pool.request().input("id",sql.Int,id).query(`
  ${periodSelect} WHERE p.id=@id;
  ${shiftSelect};
  SELECT e.id AS employeeId,e.employee_code AS employeeCode,u.full_name AS fullName,p.position_name AS positionName,
    e.position_id AS positionId,r.work_date AS workDate,s.shift_code AS shiftCode,r.preference_level AS preferenceLevel,r.note
  FROM schedule_registration_periods rp JOIN employees e ON e.branch_id=rp.branch_id AND e.status='working'
  JOIN users u ON u.id=e.user_id JOIN positions p ON p.id=e.position_id
  LEFT JOIN employee_shift_registrations r ON r.period_id=rp.id AND r.employee_id=e.id
  LEFT JOIN shifts s ON s.id=r.shift_id WHERE rp.id=@id ORDER BY u.full_name,r.work_date;
  SELECT d.employee_id AS employeeId,d.work_date AS workDate,s.shift_code AS shiftCode,d.work_position AS workPosition,d.note
  FROM schedule_draft_assignments d JOIN shifts s ON s.id=d.shift_id WHERE d.period_id=@id;
 `);if(!result.recordsets[0][0])return fail(res,404,"Không tìm thấy đợt đăng ký");res.json({success:true,data:{period:result.recordsets[0][0],shifts:result.recordsets[1],rows:result.recordsets[2],currentSchedules:result.recordsets[3]}})}catch(error){next(error)}}

async function builderSaveDraft(req,res,next){const pool=await getPool(),tx=new sql.Transaction(pool);let started=false;try{
 const list=Array.isArray(req.body.schedules)?req.body.schedules:[];await tx.begin();started=true;
 const pr=await new sql.Request(tx).input("id",sql.Int,req.params.periodId).query("SELECT * FROM schedule_registration_periods WITH(UPDLOCK) WHERE id=@id"),p=pr.recordset[0];
 if(!p){await tx.rollback();started=false;return fail(res,404,"Không tìm thấy đợt đăng ký")}
 if(!["locked","published"].includes(p.status)){await tx.rollback();started=false;return fail(res,409,"Cần khóa đăng ký trước khi xếp lịch")}
 const shifts=await new sql.Request(tx).query(shiftSelect),byCode=new Map(shifts.recordset.map(x=>[x.shiftCode,x.shiftId]));
 const employees=await new sql.Request(tx).input("branchId",sql.Int,p.branch_id).query("SELECT id FROM employees WHERE branch_id=@branchId AND status='working'"),ids=new Set(employees.recordset.map(x=>Number(x.id)));
 const start=new Date(p.week_start_date).toISOString().slice(0,10),end=new Date(p.week_end_date).toISOString().slice(0,10);
 for(const x of list)if(!ids.has(Number(x.employeeId))||!validDate(x.workDate)||x.workDate<start||x.workDate>end||!byCode.has(x.shiftCode)){await tx.rollback();started=false;return fail(res,400,"Dữ liệu xếp lịch không hợp lệ")}
 await new sql.Request(tx).input("periodId",sql.Int,p.id).query("DELETE FROM schedule_draft_assignments WHERE period_id=@periodId");
 for(const x of list)await new sql.Request(tx).input("periodId",sql.Int,p.id).input("employeeId",sql.Int,x.employeeId).input("shiftId",sql.Int,byCode.get(x.shiftCode)).input("date",sql.Date,x.workDate).input("position",sql.NVarChar(100),x.workPosition||null).input("note",sql.NVarChar(500),x.note||null).input("userId",sql.Int,req.user.userId).query("INSERT INTO schedule_draft_assignments(period_id,employee_id,work_date,shift_id,work_position,note,created_by) VALUES(@periodId,@employeeId,@date,@shiftId,@position,@note,@userId)");
 await tx.commit();started=false;res.json({success:true,message:"Đã lưu bản nháp xếp lịch",data:{count:list.length}});
}catch(error){if(started)await tx.rollback().catch(()=>{});next(error)}}

async function publishDraft(req,res,next){const pool=await getPool(),tx=new sql.Transaction(pool);let started=false;try{
 await tx.begin();started=true;const pr=await new sql.Request(tx).input("id",sql.Int,req.params.id).query("SELECT * FROM schedule_registration_periods WITH(UPDLOCK) WHERE id=@id"),p=pr.recordset[0];
 if(!p||!["locked","published"].includes(p.status)){await tx.rollback();started=false;return fail(res,409,"Chỉ công bố sau khi đã khóa đăng ký")}
 if(p.is_test&&!scheduleTestMode){await tx.rollback();started=false;return fail(res,403,"Chế độ kiểm thử đang tắt")}
 const drafts=await new sql.Request(tx).input("periodId",sql.Int,p.id).query("SELECT * FROM schedule_draft_assignments WHERE period_id=@periodId");
 if(!drafts.recordset.length){await tx.rollback();started=false;return fail(res,409,"Chưa có bản nháp lịch để công bố")}
 const cleanup=new sql.Request(tx).input("branchId",sql.Int,p.branch_id).input("start",sql.Date,p.week_start_date).input("end",sql.Date,p.week_end_date);
 if(p.is_test)await cleanup.query(`
   DELETE al FROM attendance_logs al JOIN employee_schedules es ON es.id=al.schedule_id
   WHERE al.is_test=1 AND es.is_test=1 AND es.branch_id=@branchId AND es.work_date BETWEEN @start AND @end;
   DELETE FROM employee_schedules WHERE is_test=1 AND branch_id=@branchId AND work_date BETWEEN @start AND @end;`);
 else{
   const linked=await cleanup.query(`SELECT TOP 1 es.id FROM employee_schedules es JOIN attendance_logs al ON al.schedule_id=es.id
     WHERE es.is_test=0 AND es.branch_id=@branchId AND es.work_date BETWEEN @start AND @end`);
   if(linked.recordset[0]){await tx.rollback();started=false;return fail(res,409,"Khoảng lịch này đã có chấm công, không thể ghi đè lịch chính thức")}
   await new sql.Request(tx).input("branchId",sql.Int,p.branch_id).input("start",sql.Date,p.week_start_date).input("end",sql.Date,p.week_end_date)
     .query("DELETE FROM employee_schedules WHERE is_test=0 AND branch_id=@branchId AND work_date BETWEEN @start AND @end");
 }
 await new sql.Request(tx).input("periodId",sql.Int,p.id).input("branchId",sql.Int,p.branch_id).input("isTest",sql.Bit,Boolean(p.is_test)).input("userId",sql.Int,req.user.userId).query(`INSERT INTO employee_schedules(employee_id,shift_id,branch_id,work_date,work_position,note,status,is_test,created_by)
   SELECT employee_id,shift_id,@branchId,work_date,work_position,note,'scheduled',@isTest,@userId FROM schedule_draft_assignments WHERE period_id=@periodId`);
 await new sql.Request(tx).input("id",sql.Int,p.id).input("userId",sql.Int,req.user.userId).query("UPDATE schedule_registration_periods SET status='published',published_by=@userId,published_at=SYSDATETIME(),updated_at=SYSDATETIME() WHERE id=@id");
 await new sql.Request(tx).input("branchId",sql.Int,p.branch_id).input("periodId",sql.Int,p.id).input("content",sql.NVarChar(1000),`Lịch làm từ ${new Date(p.week_start_date).toLocaleDateString("vi-VN")} đến ${new Date(p.week_end_date).toLocaleDateString("vi-VN")} đã được cập nhật.`).query("INSERT INTO notifications(user_id,notification_type,title,content,reference_type,reference_id) SELECT e.user_id,'schedule_published',N'Lịch làm mới đã được công bố',@content,'schedule_registration_period',@periodId FROM employees e JOIN users u ON u.id=e.user_id WHERE e.branch_id=@branchId AND e.status='working' AND u.status='active'");
 await tx.commit();started=false;res.json({success:true,message:"Công bố lịch thành công",data:{count:drafts.recordset.length}});
}catch(error){if(started)await tx.rollback().catch(()=>{});next(error)}}
async function builderSave(req,res,next){const pool=await getPool(),tx=new sql.Transaction(pool);let started=false;try{const list=Array.isArray(req.body.schedules)?req.body.schedules:[];await tx.begin();started=true;const pr=await new sql.Request(tx).input("id",sql.Int,req.params.periodId).query("SELECT * FROM schedule_registration_periods WITH(UPDLOCK) WHERE id=@id");const p=pr.recordset[0];if(!p){await tx.rollback();started=false;return fail(res,404,"Không tìm thấy đợt đăng ký")}if(!["locked","published"].includes(p.status)){await tx.rollback();started=false;return fail(res,409,"Cần khóa đăng ký trước khi xếp lịch")}if(p.is_test&&!scheduleTestMode){await tx.rollback();started=false;return fail(res,403,"Chế độ kiểm thử đang tắt")}const shifts=await new sql.Request(tx).query(shiftSelect),byCode=new Map(shifts.recordset.map(x=>[x.shiftCode,x.shiftId]));const employees=await new sql.Request(tx).input("branchId",sql.Int,p.branch_id).query("SELECT id FROM employees WHERE branch_id=@branchId AND status='working'"),ids=new Set(employees.recordset.map(x=>Number(x.id)));for(const x of list)if(!ids.has(Number(x.employeeId))||!validDate(x.workDate)||x.workDate<new Date(p.week_start_date).toISOString().slice(0,10)||x.workDate>new Date(p.week_end_date).toISOString().slice(0,10)||!byCode.has(x.shiftCode)){await tx.rollback();started=false;return fail(res,400,"Dữ liệu xếp lịch không hợp lệ")}
 const cleanup=new sql.Request(tx).input("branchId",sql.Int,p.branch_id).input("start",sql.Date,p.week_start_date).input("end",sql.Date,p.week_end_date);
 if(p.is_test)await cleanup.query(`DELETE al FROM attendance_logs al JOIN employee_schedules es ON es.id=al.schedule_id WHERE al.is_test=1 AND es.is_test=1 AND es.branch_id=@branchId AND es.work_date BETWEEN @start AND @end; DELETE FROM employee_schedules WHERE is_test=1 AND branch_id=@branchId AND work_date BETWEEN @start AND @end;`);
 else await cleanup.query("DELETE FROM employee_schedules WHERE is_test=0 AND branch_id=@branchId AND work_date BETWEEN @start AND @end AND NOT EXISTS(SELECT 1 FROM attendance_logs al WHERE al.schedule_id=employee_schedules.id)");
 for(const x of list){await new sql.Request(tx).input("employeeId",sql.Int,x.employeeId).input("shiftId",sql.Int,byCode.get(x.shiftCode)).input("branchId",sql.Int,p.branch_id).input("date",sql.Date,x.workDate).input("position",sql.NVarChar(100),x.workPosition||null).input("note",sql.NVarChar(500),x.note||null).input("isTest",sql.Bit,Boolean(p.is_test)).input("userId",sql.Int,req.user.userId).query("INSERT INTO employee_schedules(employee_id,shift_id,branch_id,work_date,work_position,note,status,is_test,created_by) VALUES(@employeeId,@shiftId,@branchId,@date,@position,@note,'scheduled',@isTest,@userId)")}
 if(p.status==="published")await new sql.Request(tx).input("branchId",sql.Int,p.branch_id).input("periodId",sql.Int,p.id).query("INSERT INTO notifications(user_id,notification_type,title,content,reference_type,reference_id) SELECT e.user_id,'schedule_changed',N'Lịch làm đã được điều chỉnh',N'Quản lý vừa cập nhật lịch làm đã công bố. Vui lòng kiểm tra lại lịch cá nhân.','schedule_registration_period',@periodId FROM employees e JOIN users u ON u.id=e.user_id WHERE e.branch_id=@branchId AND e.status='working' AND u.status='active'");
 await tx.commit();started=false;res.json({success:true,message:"Lưu lịch chính thức thành công",data:{count:list.length}});
}catch(error){if(started)await tx.rollback().catch(()=>{});next(error)}}
async function publish(req,res,next){const pool=await getPool(),tx=new sql.Transaction(pool);let started=false;try{await tx.begin();started=true;const pr=await new sql.Request(tx).input("id",sql.Int,req.params.id).query("SELECT * FROM schedule_registration_periods WITH(UPDLOCK) WHERE id=@id");const p=pr.recordset[0];if(!p||!["locked","published"].includes(p.status)){await tx.rollback();started=false;return fail(res,409,"Chỉ công bố sau khi đã khóa đăng ký")}const count=await new sql.Request(tx).input("branchId",sql.Int,p.branch_id).input("start",sql.Date,p.week_start_date).input("end",sql.Date,p.week_end_date).query("SELECT COUNT(*) AS total FROM employee_schedules WHERE branch_id=@branchId AND work_date BETWEEN @start AND @end");if(!count.recordset[0].total){await tx.rollback();started=false;return fail(res,409,"Chưa có lịch chính thức để công bố")}await new sql.Request(tx).input("id",sql.Int,p.id).input("userId",sql.Int,req.user.userId).query("UPDATE schedule_registration_periods SET status='published',published_by=@userId,published_at=SYSDATETIME(),updated_at=SYSDATETIME() WHERE id=@id");await new sql.Request(tx).input("branchId",sql.Int,p.branch_id).input("periodId",sql.Int,p.id).input("content",sql.NVarChar(1000),`Lịch làm từ ${new Date(p.week_start_date).toLocaleDateString("vi-VN")} đến ${new Date(p.week_end_date).toLocaleDateString("vi-VN")} đã được cập nhật.`).query("INSERT INTO notifications(user_id,notification_type,title,content,reference_type,reference_id) SELECT e.user_id,'schedule_published',N'Lịch làm tuần mới đã được công bố',@content,'schedule_registration_period',@periodId FROM employees e JOIN users u ON u.id=e.user_id WHERE e.branch_id=@branchId AND e.status='working' AND u.status='active'");await tx.commit();started=false;res.json({success:true,message:"Công bố lịch thành công"})}catch(error){if(started)await tx.rollback().catch(()=>{});next(error)}}
async function builderGetV2(req,res,next){try{
 const pool=await getPool(),periodId=Number(req.params.periodId);
 const result=await pool.request().input("periodId",sql.Int,periodId).query(`
  SELECT p.id,p.title,p.branch_id AS branchId,b.branch_name AS branchName,
    CONVERT(char(10),p.week_start_date,23) AS startDate,
    CONVERT(char(10),p.week_end_date,23) AS endDate,p.status,p.registration_open_at AS registrationOpenAt,
    p.registration_close_at AS registrationCloseAt
  FROM schedule_registration_periods p JOIN branches b ON b.id=p.branch_id WHERE p.id=@periodId;
  SELECT e.id AS employeeId,e.employee_code AS employeeCode,u.full_name AS fullName,
    pos.position_name AS positionName,b.branch_name AS branchName
  FROM schedule_registration_periods rp
  JOIN employees e ON e.branch_id=rp.branch_id AND e.status='working'
  JOIN users u ON u.id=e.user_id AND u.status='active'
  JOIN positions pos ON pos.id=e.position_id JOIN branches b ON b.id=e.branch_id
  WHERE rp.id=@periodId ORDER BY u.full_name;
  ${shiftSelect};
  SELECT r.employee_id AS employeeId,CONVERT(char(10),r.work_date,23) AS workDate,
    r.shift_id AS shiftId,s.shift_code AS shiftCode,s.shift_name AS shiftName,
    s.start_time AS startTime,s.end_time AS endTime,r.note
  FROM employee_shift_registrations r
  JOIN employees e ON e.id=r.employee_id
  JOIN schedule_registration_periods rp ON rp.id=r.period_id
  JOIN shifts s ON s.id=r.shift_id
  WHERE r.period_id=@periodId AND e.branch_id=rp.branch_id
  ORDER BY r.employee_id,r.work_date;
  SELECT d.employee_id AS employeeId,CONVERT(char(10),d.work_date,23) AS workDate,
    d.shift_id AS shiftId,s.shift_code AS shiftCode,d.work_position AS workPosition,d.note
  FROM schedule_draft_assignments d JOIN shifts s ON s.id=d.shift_id
  WHERE d.period_id=@periodId ORDER BY d.employee_id,d.work_date;
 `);
 const period=result.recordsets[0][0];if(!period)return fail(res,404,"Không tìm thấy đợt đăng ký");
 res.json({success:true,data:{period,employees:result.recordsets[1],shifts:result.recordsets[2],registrations:result.recordsets[3],draftSchedules:result.recordsets[4]}});
}catch(error){next(error)}}

async function saveEmployeeV2(req,res,next){
 const pool=await getPool(),tx=new sql.Transaction(pool);let started=false;
 try{
  const employee=await employeeFor(pool,req.user.userId);
  if(!employee)return fail(res,403,"Nhân viên không ở trạng thái làm việc");
  const registrations=Array.isArray(req.body.registrations)?req.body.registrations:[];
  await tx.begin();started=true;
  const periodResult=await new sql.Request(tx).input("id",sql.Int,req.params.periodId)
    .query("SELECT * FROM schedule_registration_periods WITH(UPDLOCK) WHERE id=@id");
  const period=periodResult.recordset[0];
  if(!period){await tx.rollback();started=false;return fail(res,404,"Không tìm thấy đợt đăng ký")}
  if(Number(period.branch_id)!==Number(employee.branchId)){await tx.rollback();started=false;return fail(res,403,"Đợt đăng ký không thuộc chi nhánh của bạn")}
  // Trạng thái do admin điều khiển là nguồn quyết định duy nhất: open được lưu, các trạng thái khác bị khóa.
  if(String(period.status||"").trim()!=="open"){await tx.rollback();started=false;return fail(res,409,"Quản lý đã khóa đợt đăng ký ca")}
  const shifts=await new sql.Request(tx).query(shiftSelect),byCode=new Map(shifts.recordset.map(item=>[item.shiftCode,item]));
  const start=new Date(period.week_start_date).toLocaleDateString("en-CA",{timeZone:"Asia/Ho_Chi_Minh"});
  const end=new Date(period.week_end_date).toLocaleDateString("en-CA",{timeZone:"Asia/Ho_Chi_Minh"});
  for(const item of registrations){
   const code=String(item.shiftCode||"").toUpperCase();
   if(!validDate(item.workDate)||item.workDate<start||item.workDate>end||!byCode.has(code)){
    await tx.rollback();started=false;return fail(res,400,"Ngày hoặc ca đăng ký không hợp lệ");
   }
  }
  await new sql.Request(tx).input("periodId",sql.Int,period.id).input("employeeId",sql.Int,employee.employeeId)
    .query("DELETE FROM employee_shift_registrations WHERE period_id=@periodId AND employee_id=@employeeId");
  for(const item of registrations){
   const shift=byCode.get(String(item.shiftCode).toUpperCase());
   await new sql.Request(tx).input("periodId",sql.Int,period.id).input("employeeId",sql.Int,employee.employeeId)
    .input("date",sql.Date,item.workDate).input("shiftId",sql.Int,shift.shiftId)
    .input("preference",sql.VarChar(20),item.preferenceLevel==="preferred"?"preferred":"available")
    .input("note",sql.NVarChar(500),req.body.note||item.note||null)
    .query("INSERT INTO employee_shift_registrations(period_id,employee_id,work_date,shift_id,preference_level,note) VALUES(@periodId,@employeeId,@date,@shiftId,@preference,@note)");
  }
  await tx.commit();started=false;
  const result=await pool.request().input("periodId",sql.Int,period.id).input("employeeId",sql.Int,employee.employeeId)
   .query("SELECT r.id,CONVERT(char(10),r.work_date,23) AS workDate,s.shift_code AS shiftCode,r.preference_level AS preferenceLevel,r.note FROM employee_shift_registrations r JOIN shifts s ON s.id=r.shift_id WHERE r.period_id=@periodId AND r.employee_id=@employeeId ORDER BY r.work_date");
  res.json({success:true,message:"Bạn đã lưu đăng ký thành công",data:result.recordset});
 }catch(error){if(started)await tx.rollback().catch(()=>{});next(error)}
}

async function saveEmployeeCurrentV2(req,res,next){try{
 const pool=await getPool(),employee=await employeeFor(pool,req.user.userId);
 if(!employee)return fail(res,403,"Nhân viên không ở trạng thái làm việc");
 const result=await pool.request().input("branchId",sql.Int,employee.branchId)
  .query("SELECT TOP 1 id FROM schedule_registration_periods WHERE branch_id=@branchId AND status='open' ORDER BY week_start_date DESC,created_at DESC");
 if(!result.recordset[0])return fail(res,404,"Hiện chưa có đợt đăng ký ca");
 req.params.periodId=result.recordset[0].id;
 return saveEmployeeV2(req,res,next);
}catch(error){next(error)}}

async function builderSaveDraftV2(req,res,next){return builderSaveDraft(req,res,next)}
async function publishDraftV2(req,res,next){
 req.params.id=req.params.periodId||req.params.id;
 return publishDraft(req,res,next);
}

async function managerSchedules(req,res,next){try{
 const {from,to}=req.query;
 if(!validDate(from)||!validDate(to)||from>to)return fail(res,400,"Khoảng ngày không hợp lệ");
 const pool=await getPool(),request=pool.request().input("from",sql.Date,from).input("to",sql.Date,to);
 const employeeWhere=["e.status='working'","u.status='active'"],scheduleWhere=["es.work_date BETWEEN @from AND @to"];
 const scopedBranch=req.managerBranchId||req.query.branchId;
 if(scopedBranch){employeeWhere.push("e.branch_id=@branchId");scheduleWhere.push("es.branch_id=@branchId");request.input("branchId",sql.Int,Number(scopedBranch))}
 if(req.query.positionId){employeeWhere.push("e.position_id=@positionId");request.input("positionId",sql.Int,Number(req.query.positionId))}
 if(req.query.employeeId){employeeWhere.push("e.id=@employeeId");scheduleWhere.push("es.employee_id=@employeeId");request.input("employeeId",sql.Int,Number(req.query.employeeId))}
 if(String(req.query.search||"").trim()){employeeWhere.push("(u.full_name COLLATE Latin1_General_CI_AI LIKE @search OR e.employee_code COLLATE Latin1_General_CI_AI LIKE @search)");request.input("search",sql.NVarChar(180),`%${String(req.query.search).trim()}%`)}
 if(req.query.status){scheduleWhere.push("es.status=@scheduleStatus");request.input("scheduleStatus",sql.VarChar(20),req.query.status)}
 const result=await request.query(`
  SELECT e.id AS employeeId,e.employee_code AS employeeCode,u.full_name AS fullName,
    p.position_name AS positionName,e.branch_id AS branchId,b.branch_name AS branchName
  FROM employees e JOIN users u ON u.id=e.user_id JOIN positions p ON p.id=e.position_id
  JOIN branches b ON b.id=e.branch_id WHERE ${employeeWhere.join(" AND ")}
  ORDER BY b.branch_name,p.position_name,u.full_name;
  SELECT es.id AS scheduleId,es.employee_id AS employeeId,CONVERT(char(10),es.work_date,23) AS workDate,
    s.shift_code AS shiftCode,s.shift_name AS shiftName,CONVERT(char(5),s.start_time,108) AS startTime,
    CONVERT(char(5),s.end_time,108) AS endTime,es.status,es.work_position AS workPosition,es.note
  FROM employee_schedules es JOIN shifts s ON s.id=es.shift_id
  WHERE ${scheduleWhere.join(" AND ")}
    AND EXISTS(SELECT 1 FROM schedule_registration_periods rp WHERE rp.branch_id=es.branch_id
      AND rp.status='published' AND es.work_date BETWEEN rp.week_start_date AND rp.week_end_date)
  ORDER BY es.employee_id,es.work_date,s.start_time;
 `);
 res.json({success:true,data:{period:{from,to},employees:result.recordsets[0],schedules:result.recordsets[1]}});
}catch(error){next(error)}}

module.exports={current,saveEmployee:saveEmployeeV2,saveEmployeeCurrent:saveEmployeeCurrentV2,periods,periodsScoped,managerScope,periodDetail,validateCreatePeriod,createPeriod,updatePeriod,deletePeriod:deletePeriodAny,transition,builderGet:builderGetV2,builderSave:builderSaveDraftV2,publish:publishDraftV2,managerSchedules};
