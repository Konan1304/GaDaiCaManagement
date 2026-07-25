require("dotenv").config();
const {sql,getPool}=require("../config/db");

const TAG="JULY_2026_FULL_ATTENDANCE_TEST";
const START="2026-07-01",END="2026-07-31";
const shiftCodes=["A","B","P1","P2","P3"];

const addMinutes=(date,minutes)=>new Date(date.getTime()+minutes*60000);
const wallDate=(day,time)=>{
  const [hour,minute]=time.split(":").map(Number);
  return new Date(Date.UTC(2026,6,day,hour,minute,0));
};

(async()=>{
  const pool=await getPool(),tx=new sql.Transaction(pool);let createdSchedules=0,updatedSchedules=0,attendanceCount=0,skippedReal=0;
  try{
    await tx.begin();
    for(const statement of [
      `IF COL_LENGTH('dbo.schedule_registration_periods','import_tag') IS NULL ALTER TABLE dbo.schedule_registration_periods ADD import_tag VARCHAR(80) NULL`,
      `IF COL_LENGTH('dbo.employee_schedules','import_tag') IS NULL ALTER TABLE dbo.employee_schedules ADD import_tag VARCHAR(80) NULL`,
      `IF COL_LENGTH('dbo.attendance_logs','import_tag') IS NULL ALTER TABLE dbo.attendance_logs ADD import_tag VARCHAR(80) NULL`
    ])await new sql.Request(tx).query(statement);
    const refs=await new sql.Request(tx).query(`
      SELECT TOP 1 id AS branchId FROM branches WHERE branch_name LIKE N'%Vạn Kiếp%' AND status='active';
      SELECT TOP 1 u.id AS adminId FROM users u JOIN roles r ON r.id=u.role_id WHERE r.role_code='admin' AND u.status='active';
      SELECT id AS shiftId,shift_code AS shiftCode,CONVERT(char(5),start_time,108) AS startTime,
        CONVERT(char(5),end_time,108) AS endTime FROM shifts WHERE shift_code IN ('A','B','P1','P2','P3') AND status='active';`);
    const branchId=refs.recordsets[0][0]?.branchId,adminId=refs.recordsets[1][0]?.adminId;
    const shifts=new Map(refs.recordsets[2].map(item=>[item.shiftCode,item]));
    if(!branchId||!adminId||shiftCodes.some(code=>!shifts.has(code)))throw new Error("Thiếu chi nhánh Vạn Kiếp, admin hoặc ca chuẩn A/B/P1/P2/P3.");
    const employees=(await new sql.Request(tx).input("branchId",sql.Int,branchId).query(`
      SELECT e.id AS employeeId,e.employee_code AS employeeCode,u.full_name AS fullName
      FROM employees e JOIN users u ON u.id=e.user_id
      WHERE e.branch_id=@branchId AND e.status='working' AND u.status='active' ORDER BY e.id`)).recordset;
    await new sql.Request(tx).input("branchId",sql.Int,branchId).input("adminId",sql.Int,adminId).input("tag",sql.VarChar(80),TAG).query(`
      IF NOT EXISTS(SELECT 1 FROM schedule_registration_periods WHERE import_tag=@tag AND is_test=1)
        INSERT schedule_registration_periods(branch_id,title,week_start_date,week_end_date,registration_open_at,
          registration_close_at,status,is_test,import_tag,created_by,published_by,published_at,note)
        VALUES(@branchId,N'Lịch kiểm thử đầy đủ tháng 07/2026','2026-07-01','2026-07-31','2026-06-01','2026-06-30',
          'published',1,@tag,@adminId,@adminId,SYSDATETIME(),N'Dữ liệu kiểm thử, không tính lương thật');
      ELSE UPDATE schedule_registration_periods SET status='published',published_by=@adminId,
        published_at=COALESCE(published_at,SYSDATETIME()) WHERE import_tag=@tag AND is_test=1`);
    for(let employeeIndex=0;employeeIndex<employees.length;employeeIndex++){
      const employee=employees[employeeIndex];
      for(let day=1;day<=31;day++){
        if((day+employeeIndex)%7===0)continue;
        const shift=shifts.get(shiftCodes[(day+employeeIndex)%shiftCodes.length]);
        const date=`2026-07-${String(day).padStart(2,"0")}`;
        const existing=await new sql.Request(tx).input("employeeId",sql.Int,employee.employeeId).input("date",sql.Date,date).query(`
          SELECT TOP 1 id,is_test AS isTest,import_tag AS importTag FROM employee_schedules
          WHERE employee_id=@employeeId AND work_date=@date AND status<>'cancelled'
          ORDER BY CASE WHEN is_test=0 THEN 0 ELSE 1 END,id`);
        let scheduleId;
        if(existing.recordset[0]&&!existing.recordset[0].isTest){skippedReal++;continue}
        if(existing.recordset[0]){
          scheduleId=existing.recordset[0].id;
          await new sql.Request(tx).input("id",sql.Int,scheduleId).input("shiftId",sql.Int,shift.shiftId)
            .input("tag",sql.VarChar(80),TAG).query(`UPDATE employee_schedules SET shift_id=@shiftId,status='completed',
              is_test=1,import_tag=@tag,note=N'Dữ liệu chấm công kiểm thử tháng 07/2026',updated_at=SYSDATETIME() WHERE id=@id`);
          updatedSchedules++;
        }else{
          const inserted=await new sql.Request(tx).input("employeeId",sql.Int,employee.employeeId).input("shiftId",sql.Int,shift.shiftId)
            .input("branchId",sql.Int,branchId).input("date",sql.Date,date).input("adminId",sql.Int,adminId).input("tag",sql.VarChar(80),TAG)
            .query(`INSERT employee_schedules(employee_id,shift_id,branch_id,work_date,status,is_test,import_tag,created_by,note)
              OUTPUT INSERTED.id VALUES(@employeeId,@shiftId,@branchId,@date,'completed',1,@tag,@adminId,N'Dữ liệu chấm công kiểm thử tháng 07/2026')`);
          scheduleId=inserted.recordset[0].id;createdSchedules++;
        }
        const late=(day+employeeIndex)%5===0?((day%3)+1)*5:0;
        const early=(day+employeeIndex)%7===1?10:0;
        const checkIn=addMinutes(wallDate(day,shift.startTime),late);
        let checkOut=wallDate(day,shift.endTime);
        if(shift.endTime<=shift.startTime)checkOut=addMinutes(checkOut,1440);
        checkOut=addMinutes(checkOut,-early);
        const worked=Math.max(1,Math.ceil((checkOut-checkIn)/60000));
        await new sql.Request(tx).input("employeeId",sql.Int,employee.employeeId).input("scheduleId",sql.Int,scheduleId)
          .input("branchId",sql.Int,branchId).input("date",sql.Date,date).input("checkIn",sql.DateTime2,checkIn)
          .input("checkOut",sql.DateTime2,checkOut).input("worked",sql.Int,worked).input("late",sql.Int,late)
          .input("early",sql.Int,early).input("tag",sql.VarChar(80),TAG).input("adminId",sql.Int,adminId).query(`
            IF EXISTS(SELECT 1 FROM attendance_logs WHERE schedule_id=@scheduleId AND check_in_time IS NOT NULL)
              UPDATE attendance_logs SET branch_id=@branchId,work_date=@date,attendance_type='check_in',
                attendance_time=@checkIn,check_in_time=@checkIn,check_out_time=@checkOut,worked_minutes=@worked,
                late_minutes=@late,early_leave_minutes=@early,status='completed',source='system',is_test=1,
                import_tag=@tag,note=N'Dữ liệu kiểm thử đủ giờ vào/ra',updated_by=@adminId,updated_at=SYSDATETIME()
              WHERE schedule_id=@scheduleId AND check_in_time IS NOT NULL;
            ELSE INSERT attendance_logs(employee_id,schedule_id,branch_id,work_date,attendance_type,attendance_time,
                check_in_time,check_out_time,worked_minutes,late_minutes,early_leave_minutes,status,source,note,is_test,
                import_tag,updated_by,created_at,updated_at)
              VALUES(@employeeId,@scheduleId,@branchId,@date,'check_in',@checkIn,@checkIn,@checkOut,@worked,@late,@early,
                'completed','system',N'Dữ liệu kiểm thử đủ giờ vào/ra',1,@tag,@adminId,SYSDATETIME(),SYSDATETIME())`);
        attendanceCount++;
      }
    }
    await tx.commit();
    console.log({tag:TAG,employees:employees.length,createdSchedules,updatedSchedules,attendanceCount,skippedReal,from:START,to:END});
  }catch(error){await tx.rollback().catch(()=>{});throw error}finally{await pool.close()}
})().catch(error=>{console.error("Seed thất bại:",error.message);process.exit(1)});
