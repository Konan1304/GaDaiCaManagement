require("dotenv").config();
const {sql,getPool}=require("../config/db");
const TAG="JULY_2026_FULL_ATTENDANCE_TEST";
(async()=>{
  const pool=await getPool();
  const result=await pool.request().input("tag",sql.VarChar(80),TAG).query(`
    SELECT u.full_name AS fullName,e.employee_code AS employeeCode,COUNT(*) AS workDays,
      SUM(al.worked_minutes) AS totalMinutes,
      CAST(ROUND(SUM(al.worked_minutes)/60.0,2) AS decimal(10,2)) AS totalHours,
      SUM(CASE WHEN al.check_in_time IS NOT NULL AND al.check_out_time IS NOT NULL THEN 1 ELSE 0 END) AS completedDays
    FROM attendance_logs al JOIN employees e ON e.id=al.employee_id JOIN users u ON u.id=e.user_id
    WHERE al.is_test=1 AND al.import_tag=@tag
    GROUP BY u.full_name,e.employee_code ORDER BY u.full_name;
    SELECT MIN(work_date) AS minDate,MAX(work_date) AS maxDate,COUNT(*) AS attendanceRows,
      SUM(CASE WHEN check_in_time IS NULL OR check_out_time IS NULL THEN 1 ELSE 0 END) AS incompleteRows
    FROM attendance_logs WHERE is_test=1 AND import_tag=@tag;`);
  console.table(result.recordsets[0]);
  console.log(result.recordsets[1][0]);
  await pool.close();
})().catch(error=>{console.error(error);process.exit(1)});
