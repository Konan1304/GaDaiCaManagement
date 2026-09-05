process.env.APP_ENV = "sandbox";
require("../config/env").loadEnvironment("sandbox");
const fs = require("fs");
const path = require("path");
const { connect, executeBatches, verifySandbox, runMigrations, sql } = require("./dbTools");
const bcrypt = require("bcrypt");

async function createDatabase() {
  const master = await connect("master");
  try {
    const name = process.env.DB_DATABASE;
    if (!/_Test$/i.test(name)) throw new Error("Tên database Sandbox không an toàn");
    await master.request().input("name", sql.NVarChar(128), name).query(`IF DB_ID(@name) IS NULL BEGIN DECLARE @q NVARCHAR(MAX)=N'CREATE DATABASE '+QUOTENAME(@name); EXEC sp_executesql @q; END`);
  } finally { await master.close(); }
}

async function seed(pool) {
  const password = process.env.SANDBOX_DEFAULT_PASSWORD;
  if (!password) throw new Error("Thiếu SANDBOX_DEFAULT_PASSWORD");
  const hash = await bcrypt.hash(password, 12);
  const tx = new sql.Transaction(pool);
  await tx.begin();
  try {
    const q = (text) => new sql.Request(tx).query(text);
    await q(`MERGE dbo.roles t USING (VALUES ('admin',N'Quản trị viên'),('manager',N'Quản lý'),('employee',N'Nhân viên')) s(code,name) ON t.role_code=s.code WHEN MATCHED THEN UPDATE SET role_name=s.name WHEN NOT MATCHED THEN INSERT(role_code,role_name) VALUES(s.code,s.name);`);
    await q(`MERGE dbo.branches t USING (VALUES ('TEST_VK',N'TEST - Vạn Kiếp','0900000000',N'Chi nhánh kiểm thử Vạn Kiếp')) s(code,name,phone,address) ON t.branch_code=s.code WHEN MATCHED THEN UPDATE SET branch_name=s.name,phone=s.phone,address=s.address,status='active' WHEN NOT MATCHED THEN INSERT(branch_code,branch_name,phone,address,status) VALUES(s.code,s.name,s.phone,s.address,'active');`);
    await q(`MERGE dbo.positions t USING (VALUES ('MANAGER',N'Quản lý/Giám sát'),('CASHIER',N'Nhân viên thu ngân'),('KITCHEN',N'Nhân viên bếp'),('COUNTER',N'Nhân viên quầy')) s(code,name) ON t.position_code=s.code WHEN MATCHED THEN UPDATE SET position_name=s.name WHEN NOT MATCHED THEN INSERT(position_code,position_name) VALUES(s.code,s.name);`);
    await q(`MERGE dbo.shifts t USING (VALUES ('A',N'Ca A',CAST('08:00' AS TIME),CAST('16:00' AS TIME),'full_time'),('B',N'Ca B',CAST('16:00' AS TIME),CAST('23:00' AS TIME),'full_time'),('P1',N'Ca P1',CAST('08:00' AS TIME),CAST('12:00' AS TIME),'part_time'),('P2',N'Ca P2',CAST('12:00' AS TIME),CAST('17:00' AS TIME),'part_time'),('P3',N'Ca P3',CAST('17:00' AS TIME),CAST('23:00' AS TIME),'part_time')) s(code,name,start_at,end_at,kind) ON t.shift_code=s.code WHEN MATCHED THEN UPDATE SET shift_name=s.name,start_time=s.start_at,end_time=s.end_at,shift_type=s.kind,status='active' WHEN NOT MATCHED THEN INSERT(shift_code,shift_name,start_time,end_time,break_minutes,status,shift_type) VALUES(s.code,s.name,s.start_at,s.end_at,0,'active',s.kind);`);
    await q(`MERGE dbo.units t USING (VALUES ('KG',N'Kilogram'),('LITER',N'Lít'),('BOTTLE',N'Chai'),('BAG',N'Gói'),('PIECE',N'Phần'),('CUP',N'Ly')) s(code,name) ON t.unit_code=s.code WHEN NOT MATCHED THEN INSERT(unit_code,unit_name) VALUES(s.code,s.name);`);
    await q(`MERGE dbo.categories t USING (VALUES ('INGREDIENT',N'Nguyên liệu','ingredient'),('POWDER',N'Bột','ingredient'),('SAUCE',N'Sốt','ingredient'),('DRINK',N'Đồ uống','sale'),('SIDE_DISH',N'Thực phẩm ăn kèm','sale'),('PACKAGING',N'Bao bì','packaging')) s(code,name,kind) ON t.category_code=s.code WHEN MATCHED THEN UPDATE SET category_name=s.name,category_type=s.kind,status='active' WHEN NOT MATCHED THEN INSERT(category_code,category_name,category_type,status) VALUES(s.code,s.name,s.kind,'active');`);
    await q(`MERGE dbo.suppliers t USING (VALUES ('TEST_NCC01',N'Nhà cung cấp nguyên liệu TEST',N'Liên hệ TEST','0900000001',N'Địa chỉ kiểm thử')) s(code,name,contact,phone,address) ON t.supplier_code=s.code WHEN MATCHED THEN UPDATE SET supplier_name=s.name,status='active' WHEN NOT MATCHED THEN INSERT(supplier_code,supplier_name,contact_name,phone,address,status) VALUES(s.code,s.name,s.contact,s.phone,s.address,'active');`);
    const products = [["TEST_CHICKEN", "Gà viên TEST", "INGREDIENT", "KG", "ingredient", 0, 70000], ["TEST_FLOUR", "Bột chiên gà TEST", "POWDER", "BAG", "ingredient", 0, 45000], ["TEST_SAUCE", "Sốt tương tỏi TEST", "SAUCE", "BOTTLE", "ingredient", 0, 35000], ["TEST_COLA", "Coca-Cola TEST", "DRINK", "BOTTLE", "sale_item", 15000, 8000], ["TEST_RICECAKE", "Bánh gạo TEST", "SIDE_DISH", "PIECE", "sale_item", 25000, 12000], ["TEST_CUP", "Ly nhựa 14oz TEST", "PACKAGING", "CUP", "packaging", 0, 1000]];
    for (const [code,name,cat,unit,type,sale,cost] of products) await new sql.Request(tx).input("code",sql.VarChar(50),code).input("name",sql.NVarChar(200),name).input("cat",sql.VarChar(30),cat).input("unit",sql.VarChar(30),unit).input("type",sql.VarChar(30),type).input("sale",sql.Decimal(18,2),sale).input("cost",sql.Decimal(18,2),cost).query(`MERGE dbo.products t USING (SELECT @code code) s ON t.product_code=s.code WHEN MATCHED THEN UPDATE SET product_name=@name,category_id=(SELECT id FROM categories WHERE category_code=@cat),unit_id=(SELECT id FROM units WHERE unit_code=@unit),product_type=@type,sale_price=@sale,cost_price=@cost,status='active' WHEN NOT MATCHED THEN INSERT(category_id,unit_id,product_code,product_name,product_type,sale_price,cost_price,status) VALUES((SELECT id FROM categories WHERE category_code=@cat),(SELECT id FROM units WHERE unit_code=@unit),@code,@name,@type,@sale,@cost,'active');`);
    const accounts = [
      ["test.admin@daiga.test","Quản trị Sandbox","admin","MANAGER","TEST_ADMIN"], ["test.manager@daiga.test","Quản lý Sandbox","manager","MANAGER","TEST_MANAGER"], ["test.supervisor@daiga.test","Giám sát Sandbox","manager","MANAGER","TEST_SUPERVISOR"], ["test.warehouse@daiga.test","Kho Sandbox","manager","COUNTER","TEST_WAREHOUSE"], ["test.accountant@daiga.test","Kế toán Sandbox","manager","COUNTER","TEST_ACCOUNTANT"],
      ["test.employee01@daiga.test","Nhân viên Test 01","employee","CASHIER","TEST_EMP01"], ["test.employee02@daiga.test","Nhân viên Test 02","employee","CASHIER","TEST_EMP02"], ["test.employee03@daiga.test","Nhân viên Test 03","employee","KITCHEN","TEST_EMP03"], ["test.employee04@daiga.test","Nhân viên Test 04","employee","KITCHEN","TEST_EMP04"], ["test.employee05@daiga.test","Nhân viên Test 05","employee","COUNTER","TEST_EMP05"], ["test.employee06@daiga.test","Nhân viên Test 06","employee","COUNTER","TEST_EMP06"]
    ];
    for (const [email,name,role,position,employeeCode] of accounts) {
      const req = new sql.Request(tx).input("email",sql.VarChar(150),email).input("name",sql.NVarChar(150),name).input("role",sql.VarChar(30),role).input("hash",sql.VarChar(255),hash).input("position",sql.VarChar(30),position).input("employeeCode",sql.VarChar(30),employeeCode);
      await req.query(`MERGE dbo.users t USING (SELECT @email email) s ON t.email=s.email WHEN MATCHED THEN UPDATE SET full_name=@name,role_id=(SELECT id FROM roles WHERE role_code=@role),password_hash=@hash,status='active',is_test=1,import_tag='SANDBOX_BASE' WHEN NOT MATCHED THEN INSERT(role_id,full_name,email,password_hash,status,is_test,import_tag) VALUES((SELECT id FROM roles WHERE role_code=@role),@name,@email,@hash,'active',1,'SANDBOX_BASE'); DECLARE @uid INT=(SELECT id FROM users WHERE email=@email); MERGE dbo.employees t USING (SELECT @uid user_id) s ON t.user_id=s.user_id WHEN MATCHED THEN UPDATE SET branch_id=(SELECT id FROM branches WHERE branch_code='TEST_VK'),position_id=(SELECT id FROM positions WHERE position_code=@position),status='working',is_test=1,import_tag='SANDBOX_BASE' WHEN NOT MATCHED THEN INSERT(user_id,branch_id,position_id,employee_code,hire_date,status,is_test,import_tag) VALUES(@uid,(SELECT id FROM branches WHERE branch_code='TEST_VK'),(SELECT id FROM positions WHERE position_code=@position),@employeeCode,'2026-06-01','working',1,'SANDBOX_BASE');`);
    }
    await q(`MERGE dbo.system_settings t USING (VALUES ('sandbox_initial_datetime',N'2026-06-01T07:45:00',N'Mốc khởi tạo đã xác nhận; chưa phải BusinessClock'),('hourly_rate',N'26000',N'Mức lương giờ Sandbox')) s(k,v,d) ON t.setting_key=s.k WHEN MATCHED THEN UPDATE SET setting_value=s.v,description=s.d,updated_at=SYSDATETIME() WHEN NOT MATCHED THEN INSERT(setting_key,setting_value,description) VALUES(s.k,s.v,s.d);`);
    await q(`INSERT dbo.salary_settings(position_id,hourly_rate,effective_from,status) SELECT p.id,26000,'2026-01-01','active' FROM dbo.positions p WHERE NOT EXISTS(SELECT 1 FROM dbo.salary_settings s WHERE s.position_id=p.id AND s.effective_from='2026-01-01');`);
    await tx.commit();
  } catch (error) { await tx.rollback(); throw error; }
}

(async () => {
  await createDatabase();
  const pool = await connect();
  try {
    await verifySandbox(pool);
    const exists = await pool.request().query("SELECT OBJECT_ID('dbo.roles','U') AS id");
    if (!exists.recordset[0].id) {
      let base = fs.readFileSync(path.resolve(__dirname,"../../database/GaDaiCa.sql"),"utf8");
      base = base.slice(0, base.indexOf("INSERT INTO roles"));
      base = base.split(/^\s*GO\s*$/gim).filter((batch)=>!/USE\s+master/i.test(batch)&&!/CREATE\s+DATABASE\s+GaDaiCaManagement/i.test(batch)&&!/USE\s+GaDaiCaManagement/i.test(batch)).join("\nGO\n");
      await executeBatches(pool, base);
    }
    const migrations = await runMigrations(pool);
    await seed(pool);
    console.log(`Sandbox sẵn sàng: ${process.env.DB_DATABASE}`);
    console.log(`Migration mới chạy: ${migrations.length ? migrations.join(', ') : 'không có'}`);
  } finally { await pool.close(); }
})().catch((error) => { console.error("Khởi tạo Sandbox thất bại:", error.message); process.exit(1); });
