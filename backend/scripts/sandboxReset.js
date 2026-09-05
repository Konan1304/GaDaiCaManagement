process.env.APP_ENV = "sandbox";
require("../config/env").loadEnvironment("sandbox");
const { connect, verifySandbox, sql } = require("./dbTools");
const fs=require("fs"),path=require("path");

const confirmation = process.argv.find((value)=>value.startsWith("--confirm="))?.slice(10);
(async()=>{
  if (!confirmation || confirmation !== process.env.SANDBOX_RESET_CODE) throw new Error(`Cần mã xác nhận: npm run sandbox:reset -- --confirm=${process.env.SANDBOX_RESET_CODE}`);
  const pool=await connect();
  try{
    await verifySandbox(pool);
    const tx=new sql.Transaction(pool);await tx.begin();
    try{
      const tables=["shift_inventory_audit_logs","inventory_discrepancies","shift_inventory_items","shift_inventory_sessions","chat_read_states","notifications","chat_messages","operation_attachments","shift_handovers","shift_report_versions","shift_cash_counts","shift_cash_denominations","shift_closing_reports","business_events","shift_operation_audit_logs","operation_shift_assignments","payrolls","attendance_logs","shift_expenses","payments","order_items","orders","shift_sessions","inventory_transactions","supplier_purchase_order_items","supplier_purchase_orders","purchase_receipt_items","purchase_receipts","schedule_draft_assignments","employee_shift_registrations","employee_schedules","schedule_registration_periods","leave_requests"];
      for(const table of tables) await new sql.Request(tx).input("table",sql.NVarChar(128),table).query(`IF OBJECT_ID(N'dbo.'+@table,'U') IS NOT NULL BEGIN DECLARE @q NVARCHAR(MAX)=N'DELETE FROM dbo.'+QUOTENAME(@table);EXEC sp_executesql @q;END`);
      await new sql.Request(tx).query("UPDATE dbo.branch_inventories SET quantity=0,average_cost=0,updated_at=SYSDATETIME()");
      await tx.commit();const uploadRoot=path.resolve(__dirname,"../uploads/sandbox/operations");if(uploadRoot.includes(`${path.sep}sandbox${path.sep}`)&&fs.existsSync(uploadRoot))for(const name of fs.readdirSync(uploadRoot))fs.rmSync(path.join(uploadRoot,name),{force:true});console.log(`Đã reset dữ liệu nghiệp vụ trong ${process.env.DB_DATABASE}; dữ liệu nền và tài khoản được giữ lại.`);
    }catch(error){await tx.rollback();throw error}
  }finally{await pool.close()}
})().catch((error)=>{console.error("Reset Sandbox bị từ chối/thất bại:",error.message);process.exit(1)});
