const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const useSqlLogin=Boolean(String(process.env.DB_USER||'').trim());
const sql = useSqlLogin ? require("mssql") : require("mssql/msnodesqlv8");

const migrationOrder = [
  "20260725_shift_registration.sql",
  "20260725_flexible_registration_periods.sql",
  "20260725_schedule_test_mode.sql",
  "20260725_attendance_sessions.sql",
  "20260725_manager_attendance.sql",
  "20260725_payroll.sql",
  "20260725_test_employee_accounts.sql",
  "20260728_suppliers_module.sql",
  "20260728_purchase_imports_module.sql",
  "20260731_weekly_shift_registration.sql",
  "20260731_operation_shift_foundation.sql",
  "20260731_operation_shift_reporting.sql",
  "20260801_operation_suite.sql",
  "20260802_shift_report_xanh_sm.sql",
  "20260831_supplier_purchase_orders.sql",
  "20260831_employee_purchase_receipts.sql",
  "20260725_july_attendance_test_batch.sql",
  "20260815_shift_inventory_production.sql",
  "20260901_shift_session_environment_key.sql",
  "20260902_employee_personal_profile.sql",
  "20260903_update_email_domain_to_gdc.sql",
  "20260903_employee_profile_update_lock.sql",
  "20260903_standardize_employee_positions.sql",
  "20260903_employee_employment_type.sql",
  "20260905_branch_operational_reports.sql",
  "20260905_chat_custom_channels.sql",
  "20260908_platform_security.sql",
  "20260910_chat_reports_completion.sql",
];
const sandboxMigrationOrder = ["20260806_shift_inventory_sandbox.sql"];

function splitBatches(source) { return source.split(/^\s*GO\s*$/gim).map((value) => value.trim()).filter(Boolean); }
function connectionConfig(database) {
  const yesNo = (value, fallback) => String(value ?? fallback).toLowerCase() === "true" ? "yes" : "no";
  if(useSqlLogin)return {server:process.env.DB_SERVER,database,user:process.env.DB_USER,password:process.env.DB_PASSWORD,port:Number(process.env.DB_PORT||1433),options:{encrypt:yesNo(process.env.DB_ENCRYPT,false)==='yes',trustServerCertificate:yesNo(process.env.DB_TRUST_SERVER_CERTIFICATE,true)==='yes'},requestTimeout:60000};
  return { connectionString: ["Driver={ODBC Driver 17 for SQL Server}", `Server={${process.env.DB_SERVER}}`, `Database={${database}}`, "Trusted_Connection={yes}", `Encrypt={${yesNo(process.env.DB_ENCRYPT, false)}}`, `TrustServerCertificate={${yesNo(process.env.DB_TRUST_SERVER_CERTIFICATE, true)}}`].join(";"), requestTimeout: 60000 };
}
async function connect(database = process.env.DB_DATABASE) { return new sql.ConnectionPool(connectionConfig(database)).connect(); }
async function executeBatches(pool, source) { for (const batch of splitBatches(source)) await pool.request().batch(batch); }
async function verifySandbox(pool) {
  if (process.env.APP_ENV !== "sandbox") throw new Error("Thao tác này chỉ được chạy khi APP_ENV=sandbox");
  const result = await pool.request().query("SELECT DB_NAME() AS name");
  const actual = result.recordset[0]?.name;
  if (!/_Test$/i.test(actual || "") || actual !== process.env.DB_DATABASE) throw new Error(`Khóa an toàn Sandbox từ chối database: ${actual}`);
  return actual;
}
async function ensureMigrationTable(pool) {
  await pool.request().batch(`IF OBJECT_ID('dbo.schema_migrations','U') IS NULL CREATE TABLE dbo.schema_migrations (id INT IDENTITY PRIMARY KEY, migration_name VARCHAR(200) NOT NULL UNIQUE, checksum CHAR(64) NOT NULL, applied_at DATETIME2 NOT NULL DEFAULT SYSDATETIME())`);
}
async function runMigrations(pool) {
  await ensureMigrationTable(pool);
  const root = path.resolve(__dirname, "../../database/migrations");
  const applied = [];
  const selectedMigrations = process.env.APP_ENV === "sandbox" ? [...migrationOrder, ...sandboxMigrationOrder] : migrationOrder;
  for (const name of selectedMigrations) {
    const source = fs.readFileSync(path.join(root, name), "utf8");
    const checksum = crypto.createHash("sha256").update(source).digest("hex");
    const existing = await pool.request().input("name", sql.VarChar(200), name).query("SELECT checksum FROM dbo.schema_migrations WHERE migration_name=@name");
    if (existing.recordset.length) {
      if (existing.recordset[0].checksum !== checksum) throw new Error(`Migration đã bị sửa sau khi chạy: ${name}`);
      continue;
    }
    await executeBatches(pool, source);
    await pool.request().input("name", sql.VarChar(200), name).input("checksum", sql.Char(64), checksum).query("INSERT dbo.schema_migrations(migration_name,checksum) VALUES(@name,@checksum)");
    applied.push(name);
  }
  return applied;
}
module.exports = { sql, splitBatches, connect, executeBatches, verifySandbox, runMigrations };
