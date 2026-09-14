const path=require("path");
const ExcelJS=require("exceljs");

process.env.APP_ENV="production";
const {sql,getPool}=require("../config/db");

const workbookPath=path.resolve(__dirname,"../../database/lich-lam-thang-8.xlsx");
const apply=process.argv.includes("--apply");
const branchArg=(process.argv.find(value=>value.startsWith("--branch="))||"").split("=")[1]?.toUpperCase()||"";
const employeeCodeAliases=new Map([["1","NV001"],["2","NV002"]]);
const importNote="Nhập từ lịch làm.xlsx tháng 08/2026";
const codeTimes={A:"08:00-16:00",B:"16:00-23:00",P1:"08:00-12:00",P2:"12:00-17:00",P3:"17:00-23:00"};

function text(value){
  if(value==null)return "";
  if(value instanceof Date)return `${value.getFullYear()}-${String(value.getMonth()+1).padStart(2,"0")}-${String(value.getDate()).padStart(2,"0")}`;
  if(typeof value!=="object")return String(value).trim();
  return String(value.text??value.result??(value.richText?value.richText.map(item=>item.text).join(""):"")).trim();
}
function isoDate(value){
  const raw=text(value);
  if(/^2026-\d{2}-\d{2}$/.test(raw))return raw;
  const match=raw.match(/^(\d{1,2})\/(\d{1,2})(?:\/2026)?$/);
  if(!match)return null;
  return `2026-${match[2].padStart(2,"0")}-${match[1].padStart(2,"0")}`;
}
function timeRange(value){
  let raw=text(value).toUpperCase().replace(/\s+/g,"");
  raw=codeTimes[raw]||raw;
  const match=raw.match(/^(\d{1,2}):(\d{2})-(\d{1,2}):(\d{2})$/);
  if(!match)return null;
  const start=`${match[1].padStart(2,"0")}:${match[2]}`;
  const end=`${match[3].padStart(2,"0")}:${match[4]}`;
  const minutes=(Number(match[3])*60+Number(match[4]))-(Number(match[1])*60+Number(match[2]));
  return {start,end,minutes:minutes>0?minutes:minutes+1440,display:raw};
}
function branchFromTitle(title){
  const normalized=title.toLocaleLowerCase("vi-VN");
  if(normalized.includes("vạn kiếp"))return "CN001";
  if(normalized.includes("vĩnh viễn"))return "GVV";
  if(normalized.includes("gò vấp"))return "CNGV";
  return null;
}
function blockDates(title){
  const match=title.match(/(\d{1,2})\/(\d{1,2})\s*$/);
  if(!match)return [];
  const end=new Date(2026,Number(match[2])-1,Number(match[1]));
  return Array.from({length:7},(_,index)=>{const date=new Date(end);date.setDate(end.getDate()-6+index);return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`});
}
async function parseWorkbook(){
  const workbook=new ExcelJS.Workbook();
  await workbook.xlsx.readFile(workbookPath);
  const sheet=workbook.worksheets[0],rows=[];
  for(let rowNumber=1;rowNumber<=sheet.rowCount;rowNumber++){
    const title=text(sheet.getCell(rowNumber,1).value),branchCode=branchFromTitle(title);
    if(!branchCode||!title.toLocaleLowerCase("vi-VN").includes("lịch làm việc"))continue;
    const dates=blockDates(title).map((date,index)=>({column:index+4,date}));
    for(let employeeRow=rowNumber+3;employeeRow<rowNumber+19;employeeRow++){
      const employeeCode=text(sheet.getCell(employeeRow,1).value);
      if(!employeeCode||/chi phí|mã nhân viên/i.test(employeeCode))continue;
      for(const item of dates){
        if(!item.date||item.date<"2026-08-01"||item.date>"2026-08-31")continue;
        const range=timeRange(sheet.getCell(employeeRow,item.column).value);
        if(range)rows.push({employeeCode,employeeName:text(sheet.getCell(employeeRow,2).value),branchCode,workDate:item.date,...range});
      }
    }
  }
  const unique=new Map();
  for(const row of rows)unique.set(`${row.employeeCode}|${row.branchCode}|${row.workDate}`,row);
  return [...unique.values()].sort((a,b)=>a.workDate.localeCompare(b.workDate)||a.employeeCode.localeCompare(b.employeeCode));
}

async function main(){
  const parsed=await parseWorkbook(),source=branchArg?parsed.filter(row=>row.branchCode===branchArg):parsed,pool=await getPool();
  const lookup=await pool.request().query(`
    SELECT e.id employeeId,e.employee_code employeeCode,e.user_id userId,u.full_name fullName,b.branch_code homeBranchCode
    FROM employees e JOIN users u ON u.id=e.user_id JOIN branches b ON b.id=e.branch_id;
    SELECT id branchId,branch_code branchCode,branch_name branchName FROM branches WHERE status='active';
    SELECT id shiftId,shift_code shiftCode,CONVERT(char(5),start_time,108) startTime FROM shifts WHERE status='active';
    SELECT TOP 1 u.id userId FROM users u JOIN roles r ON r.id=u.role_id WHERE r.role_code='admin' AND u.status='active' ORDER BY u.id;
    SELECT COUNT(*) existingCount FROM employee_schedules WHERE work_date BETWEEN '2026-08-01' AND '2026-08-31' AND ISNULL(is_test,0)=0;
  `);
  const employees=new Map(lookup.recordsets[0].map(row=>[String(row.employeeCode).toUpperCase(),row]));
  const branches=new Map(lookup.recordsets[1].map(row=>[row.branchCode,row]));
  const shifts=lookup.recordsets[2],adminId=lookup.recordsets[3][0]?.userId;
  const resolvedCode=row=>employeeCodeAliases.get(row.employeeCode.toUpperCase())||row.employeeCode.toUpperCase();
  const missing=[...new Set(source.filter(row=>!employees.has(resolvedCode(row))).map(row=>`${row.employeeCode} (${row.employeeName})`))];
  const valid=source.filter(row=>employees.has(resolvedCode(row))&&branches.has(row.branchCode));
  const summary={sourceRows:source.length,validRows:valid.length,existingAugustSchedules:lookup.recordsets[4][0].existingCount,availableBranches:lookup.recordsets[1],missingBranchCodes:[...new Set(source.filter(row=>!branches.has(row.branchCode)).map(row=>row.branchCode))],missingEmployees:missing,byBranch:{},byEmployee:{}};
  for(const row of valid){summary.byBranch[row.branchCode]=(summary.byBranch[row.branchCode]||0)+1;summary.byEmployee[row.employeeCode]=(summary.byEmployee[row.employeeCode]||0)+1}
  if(!apply){console.log(JSON.stringify(summary,null,2));await pool.close();return}
  if(!adminId)throw new Error("Không tìm thấy tài khoản admin đang hoạt động");
  const transaction=new sql.Transaction(pool);let begun=false;
  try{
    await transaction.begin();begun=true;
    for(const row of valid){
      const employee=employees.get(resolvedCode(row)),branch=branches.get(row.branchCode);
      const startMinutes=Number(row.start.slice(0,2))*60+Number(row.start.slice(3));
      const baseShift=shifts.reduce((best,current)=>{
        const currentMinutes=Number(current.startTime.slice(0,2))*60+Number(current.startTime.slice(3));
        return !best||Math.abs(currentMinutes-startMinutes)<best.distance?{...current,distance:Math.abs(currentMinutes-startMinutes)}:best;
      },null);
      const request=new sql.Request(transaction).input("employeeId",sql.Int,employee.employeeId).input("branchId",sql.Int,branch.branchId)
        .input("shiftId",sql.Int,baseShift.shiftId).input("date",sql.Date,row.workDate).input("display",sql.NVarChar(30),row.display)
        .input("start",sql.Time,row.start).input("end",sql.Time,row.end).input("note",sql.NVarChar(500),importNote).input("adminId",sql.Int,adminId)
        .input("minutes",sql.Int,row.minutes);
      const result=await request.query(`
        DECLARE @scheduleId INT=(SELECT TOP 1 id FROM employee_schedules WHERE employee_id=@employeeId AND branch_id=@branchId AND work_date=@date AND ISNULL(is_test,0)=0 ORDER BY id);
        IF @scheduleId IS NULL BEGIN
          INSERT employee_schedules(employee_id,shift_id,branch_id,work_date,display_code,start_time_override,end_time_override,note,status,is_test,created_by)
          VALUES(@employeeId,@shiftId,@branchId,@date,@display,@start,@end,@note,'completed',0,@adminId);
          SET @scheduleId=SCOPE_IDENTITY();
        END ELSE BEGIN
          UPDATE employee_schedules SET shift_id=@shiftId,branch_id=@branchId,display_code=@display,start_time_override=@start,end_time_override=@end,
            note=@note,status='completed',updated_at=SYSDATETIME() WHERE id=@scheduleId;
        END;
        DELETE FROM attendance_logs WHERE schedule_id=@scheduleId AND ISNULL(is_test,0)=0;
        INSERT attendance_logs(employee_id,schedule_id,branch_id,work_date,attendance_type,attendance_time,check_in_time,check_out_time,worked_minutes,
          late_minutes,early_leave_minutes,source,status,is_test,note)
        SELECT @employeeId,@scheduleId,@branchId,@date,'check_in',
          DATEADD(MINUTE,DATEDIFF(MINUTE,CAST('00:00' AS time),@start),CAST(@date AS datetime2)),
          DATEADD(MINUTE,DATEDIFF(MINUTE,CAST('00:00' AS time),@start),CAST(@date AS datetime2)),
          DATEADD(DAY,CASE WHEN @end<=@start THEN 1 ELSE 0 END,DATEADD(MINUTE,DATEDIFF(MINUTE,CAST('00:00' AS time),@end),CAST(@date AS datetime2))),
          @minutes,0,0,'manual','present',0,@note;
        SELECT @scheduleId scheduleId;
      `);
      if(!result.recordset[0]?.scheduleId)throw new Error(`Không nhập được ${row.employeeCode} ngày ${row.workDate}`);
    }
    for(const branchCode of [...new Set(valid.map(row=>row.branchCode))]){
      const branch=branches.get(branchCode);
      await new sql.Request(transaction).input("branchId",sql.Int,branch.branchId).input("adminId",sql.Int,adminId)
        .input("title",sql.NVarChar(200),"Lịch thực tế tháng 08/2026").input("note",sql.NVarChar(1000),importNote).query(`
          IF NOT EXISTS(
            SELECT 1 FROM schedule_registration_periods
            WHERE branch_id=@branchId AND status='published' AND week_start_date<='2026-08-01' AND week_end_date>='2026-08-31'
          )
          INSERT schedule_registration_periods(branch_id,title,week_start_date,week_end_date,registration_open_at,registration_close_at,
            status,is_test,created_by,note,published_by,published_at)
          VALUES(@branchId,@title,'2026-08-01','2026-08-31','2026-07-01T00:00:00','2026-07-31T23:59:59',
            'published',0,@adminId,@note,@adminId,SYSDATETIME());
        `);
      await new sql.Request(transaction).input("branchId",sql.Int,branch.branchId).input("note",sql.NVarChar(500),importNote).query(`
        DECLARE @periodId INT=(SELECT TOP 1 id FROM schedule_registration_periods
          WHERE branch_id=@branchId AND title=N'Lịch thực tế tháng 08/2026' ORDER BY id DESC);
        DELETE FROM employee_shift_registrations WHERE period_id=@periodId;
        ;WITH Dates AS (
          SELECT CAST('2026-08-01' AS date) work_date
          UNION ALL SELECT DATEADD(DAY,1,work_date) FROM Dates WHERE work_date<'2026-08-31'
        )
        INSERT employee_shift_registrations(period_id,employee_id,work_date,shift_id,selection_code,preference_level,note)
        SELECT @periodId,e.id,d.work_date,es.shift_id,
          CASE WHEN es.id IS NULL THEN 'OFF'
            WHEN CONVERT(char(5),es.start_time_override,108)='08:00' AND CONVERT(char(5),es.end_time_override,108)='16:00' THEN 'A'
            WHEN CONVERT(char(5),es.start_time_override,108)='16:00' AND CONVERT(char(5),es.end_time_override,108)='23:00' THEN 'B'
            WHEN CONVERT(char(5),es.start_time_override,108)='08:00' AND CONVERT(char(5),es.end_time_override,108)='12:00' THEN 'P1'
            WHEN CONVERT(char(5),es.start_time_override,108)='12:00' AND CONVERT(char(5),es.end_time_override,108)='17:00' THEN 'P2'
            WHEN CONVERT(char(5),es.start_time_override,108)='17:00' AND CONVERT(char(5),es.end_time_override,108)='23:00' THEN 'P3'
            WHEN DATEDIFF(MINUTE,es.start_time_override,es.end_time_override)>=600 THEN 'FULL'
            WHEN es.start_time_override<'12:00' THEN 'A' ELSE 'B' END,
          'available',@note
        FROM employees e CROSS JOIN Dates d
        OUTER APPLY(SELECT TOP 1 es0.* FROM employee_schedules es0
          WHERE es0.employee_id=e.id AND es0.branch_id=@branchId AND es0.work_date=d.work_date AND ISNULL(es0.is_test,0)=0
          ORDER BY CASE WHEN es0.note=@note THEN 0 ELSE 1 END,es0.id DESC) es
        WHERE e.branch_id=@branchId AND e.status='working'
        OPTION(MAXRECURSION 31);
      `);
    }
    await new sql.Request(transaction).input("adminId",sql.Int,adminId).query(`
      WITH WorkTotals AS (
        SELECT employee_id,COUNT(DISTINCT work_date) total_work_days,
          CAST(ROUND(SUM(COALESCE(worked_minutes,DATEDIFF(MINUTE,check_in_time,check_out_time)))/60.0,2) AS DECIMAL(10,2)) total_work_hours
        FROM attendance_logs
        WHERE work_date BETWEEN '2026-08-01' AND '2026-08-31' AND check_out_time IS NOT NULL AND ISNULL(is_test,0)=0
        GROUP BY employee_id
      ), PayrollSource AS (
        SELECT w.employee_id,w.total_work_days,w.total_work_hours,COALESCE(rate.hourly_rate,26000) hourly_rate
        FROM WorkTotals w JOIN employees e ON e.id=w.employee_id
        OUTER APPLY(
          SELECT TOP 1 ss.hourly_rate FROM salary_settings ss
          WHERE (ss.employee_id=e.id OR (ss.employee_id IS NULL AND ss.position_id=e.position_id))
            AND ss.effective_from<'2026-09-01' AND (ss.effective_to IS NULL OR ss.effective_to>='2026-08-01')
          ORDER BY CASE WHEN ss.employee_id=e.id THEN 0 ELSE 1 END,ss.effective_from DESC
        ) rate
      )
      MERGE payrolls target USING PayrollSource source
        ON target.employee_id=source.employee_id AND target.payroll_month='2026-08-01'
      WHEN MATCHED AND target.status='draft' THEN UPDATE SET
        total_work_days=source.total_work_days,total_work_hours=source.total_work_hours,hourly_rate=source.hourly_rate,
        base_salary=ROUND(source.total_work_hours*source.hourly_rate,0),
        net_salary=ROUND(source.total_work_hours*source.hourly_rate,0)+target.parking_allowance+target.meal_allowance+target.other_allowance+
          target.bonus-target.uniform_deduction-target.salary_advance-target.other_deduction,updated_at=SYSDATETIME()
      WHEN NOT MATCHED THEN INSERT(employee_id,payroll_month,total_work_days,total_work_hours,hourly_rate,base_salary,net_salary,status,created_by)
        VALUES(source.employee_id,'2026-08-01',source.total_work_days,source.total_work_hours,source.hourly_rate,
          ROUND(source.total_work_hours*source.hourly_rate,0),ROUND(source.total_work_hours*source.hourly_rate,0),'draft',@adminId);
    `);
    await transaction.commit();begun=false;
    const verified=await pool.request().query(`
      SELECT COUNT(*) schedules FROM employee_schedules WHERE work_date BETWEEN '2026-08-01' AND '2026-08-31' AND ISNULL(is_test,0)=0;
      SELECT COUNT(*) attendanceRows,SUM(worked_minutes) workedMinutes FROM attendance_logs WHERE work_date BETWEEN '2026-08-01' AND '2026-08-31' AND ISNULL(is_test,0)=0;
      SELECT COUNT(*) payrollEmployees,SUM(total_work_days) payrollWorkDays,SUM(total_work_hours) payrollWorkHours,
        SUM(base_salary) totalBaseSalary,SUM(net_salary) totalNetSalary FROM payrolls WHERE payroll_month='2026-08-01';
    `);
    console.log(JSON.stringify({...summary,applied:true,verified:{...verified.recordsets[0][0],...verified.recordsets[1][0],...verified.recordsets[2][0]}},null,2));
  }catch(error){if(begun)await transaction.rollback().catch(()=>{});throw error}finally{await pool.close()}
}

main().catch(error=>{console.error(error);process.exit(1)});
