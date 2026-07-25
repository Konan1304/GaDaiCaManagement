require("dotenv").config();
const {sql,getPool}=require("../config/db");
const TAG="JULY_2026_FULL_ATTENDANCE_TEST";
(async()=>{
  const pool=await getPool();
  const counts=await pool.request().input("tag",sql.VarChar(80),TAG).query(`
    SELECT COUNT(*) schedules FROM employee_schedules WHERE is_test=1 AND import_tag=@tag;
    SELECT COUNT(*) attendance FROM attendance_logs WHERE is_test=1 AND import_tag=@tag;
    SELECT COUNT(*) periods FROM schedule_registration_periods WHERE is_test=1 AND import_tag=@tag;`);
  console.log({preview:true,schedules:counts.recordsets[0][0].schedules,attendance:counts.recordsets[1][0].attendance,periods:counts.recordsets[2][0].periods});
  if(String(process.env.CONFIRM_DELETE_JULY_FULL_TEST).toLowerCase()!=="true"){
    console.log("Chỉ preview. Đặt CONFIRM_DELETE_JULY_FULL_TEST=true để xóa.");
    await pool.close();return;
  }
  const tx=new sql.Transaction(pool);
  try{await tx.begin();await new sql.Request(tx).input("tag",sql.VarChar(80),TAG).query(`
    DELETE FROM attendance_logs WHERE is_test=1 AND import_tag=@tag;
    DELETE FROM employee_schedules WHERE is_test=1 AND import_tag=@tag;
    DELETE FROM schedule_registration_periods WHERE is_test=1 AND import_tag=@tag;`);
    await tx.commit();console.log("Đã xóa sạch batch lịch/chấm công test tháng 07/2026.");
  }catch(error){await tx.rollback().catch(()=>{});throw error}finally{await pool.close()}
})().catch(error=>{console.error(error);process.exit(1)});
