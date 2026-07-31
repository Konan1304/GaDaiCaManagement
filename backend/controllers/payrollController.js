const {sql,getPool}=require("../config/db");

const DEFAULT_RATE=26000;
const moneyFields=["parkingAllowance","mealAllowance","otherAllowance","bonus","uniformDeduction","salaryAdvance","otherDeduction"];
const fail=(res,status,message)=>res.status(status).json({success:false,message});
const validMonth=value=>/^\d{4}-(0[1-9]|1[0-2])$/.test(String(value||""));
const monthStart=value=>`${value}-01`;
const amount=value=>{const number=Number(value??0);return Number.isFinite(number)&&number>=0?number:null};

async function managerBranch(pool,user){
  if(user.role==="admin")return null;
  const result=await pool.request().input("userId",sql.Int,user.userId)
    .query("SELECT TOP 1 branch_id AS branchId FROM employees WHERE user_id=@userId AND status='working'");
  return result.recordset[0]?.branchId;
}

const payrollAttendanceIsTest=process.env.APP_ENV==="sandbox"?1:0;
const attendanceCte=`
WITH AttendancePairs AS (
  SELECT employee_id,COALESCE(work_date,CAST(check_in_time AS date)) AS work_date,
    check_in_time AS check_in,check_out_time AS check_out,worked_minutes
  FROM attendance_logs
  WHERE check_in_time>=@start AND check_in_time<@end AND check_out_time IS NOT NULL AND ISNULL(is_test,0)=${payrollAttendanceIsTest}
), WorkTotals AS (
  SELECT employee_id,COUNT(DISTINCT work_date) AS total_work_days,
    CAST(ROUND(SUM(COALESCE(worked_minutes,DATEDIFF(MINUTE,check_in,check_out)))/60.0,2) AS DECIMAL(10,2)) AS total_work_hours
  FROM AttendancePairs WHERE check_out IS NOT NULL GROUP BY employee_id
)`;

function baseRequest(pool,month){
  const start=monthStart(month);
  const startDate=new Date(`${start}T00:00:00`),endDate=new Date(startDate);
  endDate.setMonth(endDate.getMonth()+1);
  return pool.request().input("month",sql.Date,start).input("start",sql.DateTime2,startDate).input("end",sql.DateTime2,endDate);
}

async function list(req,res,next){try{
  const month=req.query.month;
  if(!validMonth(month))return fail(res,400,"Tháng phải có định dạng YYYY-MM");
  const pool=await getPool(),scope=await managerBranch(pool,req.user);
  if(req.user.role!=="admin"&&!scope)return fail(res,403,"Tài khoản quản lý chưa được gán chi nhánh");
  const request=baseRequest(pool,month),where=["e.status='working'"];
  const requestedBranch=Number(req.query.branchId||0);
  if(scope){where.push("e.branch_id=@branchId");request.input("branchId",sql.Int,scope)}
  else if(requestedBranch){where.push("e.branch_id=@branchId");request.input("branchId",sql.Int,requestedBranch)}
  const result=await request.input("defaultRate",sql.Decimal(18,2),DEFAULT_RATE).query(`${attendanceCte}
    SELECT e.id AS employeeId,e.employee_code AS employeeCode,u.full_name AS fullName,
      pos.position_name AS positionName,b.branch_name AS branchName,
      COALESCE(w.total_work_days,0) AS totalWorkDays,COALESCE(w.total_work_hours,0) AS totalWorkHours,
      COALESCE(pr.hourly_rate,rate.hourly_rate,@defaultRate) AS hourlyRate,
      CASE WHEN pr.status IN('confirmed','paid') THEN pr.base_salary
        ELSE ROUND(COALESCE(w.total_work_hours,0)*COALESCE(pr.hourly_rate,rate.hourly_rate,@defaultRate),0) END AS baseSalary,
      COALESCE(pr.parking_allowance+pr.meal_allowance+pr.other_allowance+pr.bonus,0) AS totalAllowance,
      COALESCE(pr.uniform_deduction+pr.salary_advance+pr.other_deduction,0) AS totalDeduction,
      CASE WHEN pr.status IN('confirmed','paid') THEN pr.net_salary ELSE
        ROUND(COALESCE(w.total_work_hours,0)*COALESCE(pr.hourly_rate,rate.hourly_rate,@defaultRate),0)
        +COALESCE(pr.parking_allowance+pr.meal_allowance+pr.other_allowance+pr.bonus,0)
        -COALESCE(pr.uniform_deduction+pr.salary_advance+pr.other_deduction,0) END AS netSalary,
      COALESCE(pr.status,'draft') AS status
    FROM employees e JOIN users u ON u.id=e.user_id JOIN positions pos ON pos.id=e.position_id JOIN branches b ON b.id=e.branch_id
    LEFT JOIN WorkTotals w ON w.employee_id=e.id
    LEFT JOIN payrolls pr ON pr.employee_id=e.id AND pr.payroll_month=@month
    OUTER APPLY (
      SELECT TOP 1 ss.hourly_rate FROM salary_settings ss
      WHERE ss.status='active' AND (ss.employee_id=e.id OR (ss.employee_id IS NULL AND ss.position_id=e.position_id))
        AND ss.effective_from<@end AND (ss.effective_to IS NULL OR ss.effective_to>=@start)
      ORDER BY CASE WHEN ss.employee_id=e.id THEN 0 ELSE 1 END,ss.effective_from DESC
    ) rate
    WHERE ${where.join(" AND ")} ORDER BY b.branch_name,pos.position_name,u.full_name`);
  res.json({success:true,data:result.recordset});
}catch(error){next(error)}}

async function payrollDetail(pool,employeeId,month){
  const request=baseRequest(pool,month).input("employeeId",sql.Int,employeeId).input("defaultRate",sql.Decimal(18,2),DEFAULT_RATE);
  const result=await request.query(`${attendanceCte}
    SELECT e.id AS employeeId,e.employee_code AS employeeCode,u.full_name AS fullName,pos.position_name AS positionName,b.branch_name AS branchName,
      COALESCE(w.total_work_days,0) AS totalWorkDays,COALESCE(w.total_work_hours,0) AS totalWorkHours,
      COALESCE(pr.hourly_rate,rate.hourly_rate,@defaultRate) AS hourlyRate,
      CASE WHEN pr.status IN('confirmed','paid') THEN pr.base_salary
        ELSE ROUND(COALESCE(w.total_work_hours,0)*COALESCE(pr.hourly_rate,rate.hourly_rate,@defaultRate),0) END AS baseSalary,
      COALESCE(pr.parking_allowance,0) AS parkingAllowance,COALESCE(pr.meal_allowance,0) AS mealAllowance,
      COALESCE(pr.other_allowance,0) AS otherAllowance,COALESCE(pr.bonus,0) AS bonus,
      COALESCE(pr.uniform_deduction,0) AS uniformDeduction,COALESCE(pr.salary_advance,0) AS salaryAdvance,
      COALESCE(pr.other_deduction,0) AS otherDeduction,
      CASE WHEN pr.status IN('confirmed','paid') THEN pr.net_salary ELSE
        ROUND(COALESCE(w.total_work_hours,0)*COALESCE(pr.hourly_rate,rate.hourly_rate,@defaultRate),0)
        +COALESCE(pr.parking_allowance+pr.meal_allowance+pr.other_allowance+pr.bonus,0)
        -COALESCE(pr.uniform_deduction+pr.salary_advance+pr.other_deduction,0) END AS netSalary,
      COALESCE(pr.status,'draft') AS status,pr.note
    FROM employees e JOIN users u ON u.id=e.user_id JOIN positions pos ON pos.id=e.position_id JOIN branches b ON b.id=e.branch_id
    LEFT JOIN WorkTotals w ON w.employee_id=e.id LEFT JOIN payrolls pr ON pr.employee_id=e.id AND pr.payroll_month=@month
    OUTER APPLY (
      SELECT TOP 1 ss.hourly_rate FROM salary_settings ss WHERE ss.status='active'
        AND (ss.employee_id=e.id OR (ss.employee_id IS NULL AND ss.position_id=e.position_id))
        AND ss.effective_from<@end AND (ss.effective_to IS NULL OR ss.effective_to>=@start)
      ORDER BY CASE WHEN ss.employee_id=e.id THEN 0 ELSE 1 END,ss.effective_from DESC
    ) rate WHERE e.id=@employeeId;
    ${attendanceCte}
    SELECT CONVERT(char(10),work_date,23) AS workDate,MIN(check_in) AS checkIn,MAX(check_out) AS checkOut,
      CAST(ROUND(SUM(COALESCE(worked_minutes,DATEDIFF(MINUTE,check_in,check_out)))/60.0,2) AS DECIMAL(10,2)) AS totalHours
    FROM AttendancePairs WHERE employee_id=@employeeId AND check_out IS NOT NULL
    GROUP BY work_date ORDER BY work_date;`);
  return result.recordsets[0][0]?{...result.recordsets[0][0],days:result.recordsets[1]}:null;
}

async function detail(req,res,next){try{
  const month=req.query.month,employeeId=Number(req.params.employeeId);
  if(!validMonth(month)||!Number.isInteger(employeeId))return fail(res,400,"Thông tin bảng lương không hợp lệ");
  const pool=await getPool(),scope=await managerBranch(pool,req.user);
  if(scope){const allowed=await pool.request().input("id",sql.Int,employeeId).input("branchId",sql.Int,scope).query("SELECT id FROM employees WHERE id=@id AND branch_id=@branchId");if(!allowed.recordset[0])return fail(res,403,"Bạn không được xem nhân viên chi nhánh khác")}
  const data=await payrollDetail(pool,employeeId,month);
  if(!data)return fail(res,404,"Không tìm thấy nhân viên");
  res.json({success:true,data});
}catch(error){next(error)}}

async function save(req,res,next){try{
  const month=req.query.month,employeeId=Number(req.params.employeeId);
  if(!validMonth(month)||!Number.isInteger(employeeId))return fail(res,400,"Thông tin bảng lương không hợp lệ");
  for(const field of moneyFields)if(amount(req.body[field])===null)return fail(res,400,`${field} không hợp lệ`);
  const hourlyRate=amount(req.body.hourlyRate);
  if(hourlyRate===null)return fail(res,400,"Lương giờ không hợp lệ");
  const pool=await getPool(),scope=await managerBranch(pool,req.user);
  if(scope){const allowed=await pool.request().input("id",sql.Int,employeeId).input("branchId",sql.Int,scope).query("SELECT id FROM employees WHERE id=@id AND branch_id=@branchId");if(!allowed.recordset[0])return fail(res,403,"Bạn không được sửa nhân viên chi nhánh khác")}
  const live=await payrollDetail(pool,employeeId,month);if(!live)return fail(res,404,"Không tìm thấy nhân viên");
  const base=Math.round(Number(live.totalWorkHours)*hourlyRate);
  const allowance=amount(req.body.parkingAllowance)+amount(req.body.mealAllowance)+amount(req.body.otherAllowance)+amount(req.body.bonus);
  const deduction=amount(req.body.uniformDeduction)+amount(req.body.salaryAdvance)+amount(req.body.otherDeduction);
  const request=pool.request().input("employeeId",sql.Int,employeeId).input("month",sql.Date,monthStart(month))
    .input("days",sql.Int,live.totalWorkDays).input("hours",sql.Decimal(10,2),live.totalWorkHours).input("rate",sql.Decimal(18,2),hourlyRate)
    .input("base",sql.Decimal(18,2),base).input("parking",sql.Decimal(18,2),amount(req.body.parkingAllowance))
    .input("meal",sql.Decimal(18,2),amount(req.body.mealAllowance)).input("otherAllowance",sql.Decimal(18,2),amount(req.body.otherAllowance))
    .input("bonus",sql.Decimal(18,2),amount(req.body.bonus)).input("uniform",sql.Decimal(18,2),amount(req.body.uniformDeduction))
    .input("advance",sql.Decimal(18,2),amount(req.body.salaryAdvance)).input("otherDeduction",sql.Decimal(18,2),amount(req.body.otherDeduction))
    .input("net",sql.Decimal(18,2),base+allowance-deduction).input("note",sql.NVarChar(1000),String(req.body.note||"").trim()||null)
    .input("userId",sql.Int,req.user.userId);
  await request.query(`MERGE payrolls AS target USING (SELECT @employeeId employee_id,@month payroll_month) source
    ON target.employee_id=source.employee_id AND target.payroll_month=source.payroll_month
    WHEN MATCHED AND target.status='draft' THEN UPDATE SET total_work_days=@days,total_work_hours=@hours,hourly_rate=@rate,
      base_salary=@base,parking_allowance=@parking,meal_allowance=@meal,other_allowance=@otherAllowance,bonus=@bonus,
      uniform_deduction=@uniform,salary_advance=@advance,other_deduction=@otherDeduction,net_salary=@net,note=@note,updated_at=SYSDATETIME()
    WHEN NOT MATCHED THEN INSERT(employee_id,payroll_month,total_work_days,total_work_hours,hourly_rate,base_salary,parking_allowance,
      meal_allowance,other_allowance,bonus,uniform_deduction,salary_advance,other_deduction,net_salary,status,note,created_by)
      VALUES(@employeeId,@month,@days,@hours,@rate,@base,@parking,@meal,@otherAllowance,@bonus,@uniform,@advance,@otherDeduction,@net,'draft',@note,@userId);`);
  const data=await payrollDetail(pool,employeeId,month);
  if(data.status!=="draft")return fail(res,409,"Bảng lương đã xác nhận nên không thể chỉnh sửa");
  res.json({success:true,message:"Lưu bảng lương thành công",data});
}catch(error){next(error)}}

async function transition(req,res,next){try{
  const month=req.query.month,employeeId=Number(req.params.employeeId),action=req.params.action;
  if(!validMonth(month)||!["confirm","paid"].includes(action))return fail(res,400,"Thao tác không hợp lệ");
  const pool=await getPool(),scope=await managerBranch(pool,req.user);
  const request=pool.request().input("employeeId",sql.Int,employeeId).input("month",sql.Date,monthStart(month)).input("userId",sql.Int,req.user.userId);
  if(scope)request.input("branchId",sql.Int,scope);
  const expected=action==="confirm"?"draft":"confirmed",nextStatus=action==="confirm"?"confirmed":"paid";
  request.input("expected",sql.VarChar(20),expected).input("status",sql.VarChar(20),nextStatus);
  const result=await request.query(`UPDATE p SET status=@status,approved_by=CASE WHEN @status='confirmed' THEN @userId ELSE approved_by END,updated_at=SYSDATETIME()
    OUTPUT INSERTED.id FROM payrolls p JOIN employees e ON e.id=p.employee_id
    WHERE p.employee_id=@employeeId AND p.payroll_month=@month AND p.status=@expected${scope?" AND e.branch_id=@branchId":""}`);
  if(!result.recordset[0])return fail(res,409,action==="confirm"?"Hãy lưu bảng lương nháp trước khi xác nhận":"Chỉ bảng lương đã xác nhận mới được đánh dấu đã trả");
  res.json({success:true,message:action==="confirm"?"Xác nhận bảng lương thành công":"Đã đánh dấu trả lương"});
}catch(error){next(error)}}

async function calculate(req,res,next){try{
  const month=req.query.month;if(!validMonth(month))return fail(res,400,"Tháng phải có định dạng YYYY-MM");
  const current=await listCapture(req);
  const pool=await getPool();
  for(const row of current)await pool.request().input("employeeId",sql.Int,row.employeeId).input("month",sql.Date,monthStart(month))
    .input("days",sql.Int,row.totalWorkDays).input("hours",sql.Decimal(10,2),row.totalWorkHours).input("rate",sql.Decimal(18,2),row.hourlyRate)
    .input("base",sql.Decimal(18,2),row.baseSalary).input("net",sql.Decimal(18,2),row.netSalary).input("userId",sql.Int,req.user.userId)
    .query(`IF NOT EXISTS(SELECT 1 FROM payrolls WHERE employee_id=@employeeId AND payroll_month=@month)
      INSERT payrolls(employee_id,payroll_month,total_work_days,total_work_hours,hourly_rate,base_salary,net_salary,status,created_by)
      VALUES(@employeeId,@month,@days,@hours,@rate,@base,@net,'draft',@userId)
      ELSE UPDATE payrolls SET total_work_days=@days,total_work_hours=@hours,base_salary=ROUND(@hours*hourly_rate,0),
        net_salary=ROUND(@hours*hourly_rate,0)+parking_allowance+meal_allowance+other_allowance+bonus-uniform_deduction-salary_advance-other_deduction,
        updated_at=SYSDATETIME() WHERE employee_id=@employeeId AND payroll_month=@month AND status='draft'`);
  res.json({success:true,message:`Đã tính lương cho ${current.length} nhân viên`});
}catch(error){next(error)}}

async function listCapture(req){
  const pool=await getPool(),scope=await managerBranch(pool,req.user),request=baseRequest(pool,req.query.month),where=["e.status='working'"];
  if(scope){where.push("e.branch_id=@branchId");request.input("branchId",sql.Int,scope)}
  else if(Number(req.query.branchId||0)){where.push("e.branch_id=@branchId");request.input("branchId",sql.Int,Number(req.query.branchId))}
  const result=await request.input("defaultRate",sql.Decimal(18,2),DEFAULT_RATE).query(`${attendanceCte}
    SELECT e.id employeeId,COALESCE(w.total_work_days,0) totalWorkDays,COALESCE(w.total_work_hours,0) totalWorkHours,
      COALESCE(pr.hourly_rate,rate.hourly_rate,@defaultRate) hourlyRate,
      ROUND(COALESCE(w.total_work_hours,0)*COALESCE(pr.hourly_rate,rate.hourly_rate,@defaultRate),0) baseSalary,
      ROUND(COALESCE(w.total_work_hours,0)*COALESCE(pr.hourly_rate,rate.hourly_rate,@defaultRate),0)
       +COALESCE(pr.parking_allowance+pr.meal_allowance+pr.other_allowance+pr.bonus-pr.uniform_deduction-pr.salary_advance-pr.other_deduction,0) netSalary
    FROM employees e LEFT JOIN WorkTotals w ON w.employee_id=e.id LEFT JOIN payrolls pr ON pr.employee_id=e.id AND pr.payroll_month=@month
    OUTER APPLY(SELECT TOP 1 hourly_rate FROM salary_settings ss WHERE ss.status='active' AND (ss.employee_id=e.id OR (ss.employee_id IS NULL AND ss.position_id=e.position_id))
      AND ss.effective_from<@end AND (ss.effective_to IS NULL OR ss.effective_to>=@start) ORDER BY CASE WHEN ss.employee_id=e.id THEN 0 ELSE 1 END,ss.effective_from DESC) rate
    WHERE ${where.join(" AND ")}`);
  return result.recordset;
}

async function mine(req,res,next){try{
  const month=req.query.month;if(!validMonth(month))return fail(res,400,"Tháng phải có định dạng YYYY-MM");
  const pool=await getPool(),employee=await pool.request().input("userId",sql.Int,req.user.userId).query("SELECT TOP 1 id FROM employees WHERE user_id=@userId");
  if(!employee.recordset[0])return fail(res,404,"Không tìm thấy hồ sơ nhân viên");
  const data=await payrollDetail(pool,employee.recordset[0].id,month);
  res.json({success:true,data});
}catch(error){next(error)}}

module.exports={list,detail,save,transition,calculate,mine};
