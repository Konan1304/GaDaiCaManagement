require("dotenv").config();
const fs=require("fs");
const path=require("path");
const {sql,getPool}=require("../config/db");
const ADMIN_EMAIL="admin@daiga.vn";
const confirmed=String(process.env.CONFIRM_RESET_EMPLOYEES||"").toLowerCase()==="true";

(async()=>{
  const pool=await getPool();
  const preview=await pool.request().input("email",sql.NVarChar(255),ADMIN_EMAIL).query(`
    SELECT e.id AS employeeId,e.employee_code AS employeeCode,u.id AS userId,u.email,u.full_name AS fullName
    FROM employees e JOIN users u ON u.id=e.user_id WHERE u.email<>@email ORDER BY u.full_name;
    SELECT COUNT(*) AS attendance FROM attendance_logs WHERE employee_id IN
      (SELECT e.id FROM employees e JOIN users u ON u.id=e.user_id WHERE u.email<>@email);
    SELECT COUNT(*) AS schedules FROM employee_schedules WHERE employee_id IN
      (SELECT e.id FROM employees e JOIN users u ON u.id=e.user_id WHERE u.email<>@email);
    SELECT COUNT(*) AS payrolls FROM payrolls WHERE employee_id IN
      (SELECT e.id FROM employees e JOIN users u ON u.id=e.user_id WHERE u.email<>@email);
  `);
  console.log({preview:true,employees:preview.recordsets[0].length,attendance:preview.recordsets[1][0].attendance,
    schedules:preview.recordsets[2][0].schedules,payrolls:preview.recordsets[3][0].payrolls});
  console.table(preview.recordsets[0]);
  if(!confirmed){console.log("Chỉ xem trước. Đặt CONFIRM_RESET_EMPLOYEES=true để sao lưu và xóa.");await pool.close();return}

  const backupDir=path.join(__dirname,"../../database/backups");
  fs.mkdirSync(backupDir,{recursive:true});
  const stamp=new Date().toISOString().replace(/[:.]/g,"-");
  const backup={createdAt:new Date().toISOString(),adminKept:ADMIN_EMAIL,employees:preview.recordsets[0]};
  for(const table of ["employee_schedules","attendance_logs","employee_shift_registrations","schedule_draft_assignments",
    "leave_requests","shift_sessions","orders","shift_expenses","shift_closing_reports","payrolls","salary_settings"]){
    const rows=await pool.request().input("email",sql.NVarChar(255),ADMIN_EMAIL).query(`
      SELECT * FROM ${table} WHERE employee_id IN
        (SELECT e.id FROM employees e JOIN users u ON u.id=e.user_id WHERE u.email<>@email)`);
    backup[table]=rows.recordset;
  }
  const backupFile=path.join(backupDir,`employee-reset-${stamp}.json`);
  fs.writeFileSync(backupFile,JSON.stringify(backup,null,2),"utf8");

  const tx=new sql.Transaction(pool);let started=false;
  try{
    await tx.begin();started=true;
    await new sql.Request(tx).input("email",sql.NVarChar(255),ADMIN_EMAIL).query(`
      DECLARE @adminUserId int=(SELECT TOP 1 id FROM users WHERE email=@email);
      IF @adminUserId IS NULL THROW 51000,N'Không tìm thấy tài khoản admin cần giữ lại',1;
      SELECT e.id employee_id,e.user_id INTO #targets
      FROM employees e JOIN users u ON u.id=e.user_id WHERE u.email<>@email;
      UPDATE purchase_receipts SET created_by=@adminUserId WHERE created_by IN(SELECT user_id FROM #targets);
      UPDATE inventory_transactions SET created_by=@adminUserId WHERE created_by IN(SELECT user_id FROM #targets);
      UPDATE system_settings SET updated_by=@adminUserId WHERE updated_by IN(SELECT user_id FROM #targets);
      DELETE FROM payments WHERE order_id IN(SELECT id FROM orders WHERE employee_id IN(SELECT employee_id FROM #targets));
      DELETE FROM order_items WHERE order_id IN(SELECT id FROM orders WHERE employee_id IN(SELECT employee_id FROM #targets));
      DELETE FROM orders WHERE employee_id IN(SELECT employee_id FROM #targets);
      DELETE FROM shift_closing_reports WHERE employee_id IN(SELECT employee_id FROM #targets);
      DELETE FROM shift_expenses WHERE employee_id IN(SELECT employee_id FROM #targets);
      DELETE FROM shift_sessions WHERE employee_id IN(SELECT employee_id FROM #targets);
      DELETE FROM attendance_logs WHERE employee_id IN(SELECT employee_id FROM #targets);
      DELETE FROM employee_shift_registrations WHERE employee_id IN(SELECT employee_id FROM #targets);
      DELETE FROM schedule_draft_assignments WHERE employee_id IN(SELECT employee_id FROM #targets);
      DELETE FROM employee_schedules WHERE employee_id IN(SELECT employee_id FROM #targets);
      DELETE FROM leave_requests WHERE employee_id IN(SELECT employee_id FROM #targets);
      DELETE FROM payrolls WHERE employee_id IN(SELECT employee_id FROM #targets);
      DELETE FROM salary_settings WHERE employee_id IN(SELECT employee_id FROM #targets);
      DELETE FROM notifications WHERE user_id IN(SELECT user_id FROM #targets);
      DELETE FROM employees WHERE id IN(SELECT employee_id FROM #targets);
      DELETE FROM users WHERE id IN(SELECT user_id FROM #targets);
    `);
    await tx.commit();started=false;
    console.log(`Đã xóa nhân viên cũ. Bản sao lưu: ${backupFile}`);
  }catch(error){if(started)await tx.rollback().catch(()=>{});throw error}
  finally{await pool.close()}
})().catch(error=>{console.error(error);process.exit(1)});
