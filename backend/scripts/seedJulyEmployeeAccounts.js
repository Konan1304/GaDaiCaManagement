require("dotenv").config();
const bcrypt=require("bcrypt");
const {sql,getPool}=require("../config/db");

const IMPORT_TAG="JULY_2026_EXCEL_TEST";
const DEFAULT_PASSWORD="123456";
const people=[
  {name:"Vũ Thị Ngọc Bích",code:"TESTJULY_NB",email:"testjuly.ngocbich@gdc.vn",aliases:["vu thi ngoc bich","ngoc bich"]},
  {name:"Anh Kiệt",code:"TESTJULY_AK",email:"testjuly.anhkiet@gdc.vn",aliases:["anh kiet"]},
  {name:"Thiên Ân",code:"TESTJULY_TA",email:"testjuly.thienan@gdc.vn",aliases:["thien an"]},
  {name:"Nguyễn Duy Đức",code:"TESTJULY_DD",email:"testjuly.duyduc@gdc.vn",aliases:["nguyen duy duc","duc"]},
  {name:"Kỳ Anh",code:"TESTJULY_KA",email:"testjuly.kyanh@gdc.vn",aliases:["ky anh"]},
  {name:"Thái Dương",code:"TESTJULY_TD",email:"testjuly.thaiduong@gdc.vn",aliases:["le van thai duong","thai duong"]},
  {name:"An",code:"TESTJULY_AN",email:"testjuly.an@gdc.vn",aliases:["an"]},
  {name:"Mai Trinh",code:"TESTJULY_MT",email:"testjuly.maitrinh@gdc.vn",aliases:["mai trinh"]},
  {name:"Quốc Thái",code:"TESTJULY_QT",email:"testjuly.quocthai@gdc.vn",aliases:["quoc thai"]},
  {name:"Phương Trang",code:"TESTJULY_PT",email:"testjuly.phuongtrang@gdc.vn",aliases:["phuong trang"]},
  {name:"Cường",code:"TESTJULY_C",email:"testjuly.cuong@gdc.vn",aliases:["cuong"]},
  {name:"Xuân Mai",code:"TESTJULY_XM",email:"testjuly.xuanmai@gdc.vn",aliases:["xuan mai"]},
];
const normalize=value=>String(value||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/đ/g,"d").replace(/Đ/g,"D").toLowerCase().replace(/\s+/g," ").trim();

(async()=>{
  const pool=await getPool(),transaction=new sql.Transaction(pool);
  const passwordHash=await bcrypt.hash(DEFAULT_PASSWORD,12);
  let created=0,mapped=0;
  const accounts=[];
  try{
    await transaction.begin();
    for(const batch of [
      `IF COL_LENGTH('dbo.users','is_test') IS NULL ALTER TABLE dbo.users ADD is_test BIT NOT NULL CONSTRAINT DF_users_is_test DEFAULT 0`,
      `IF COL_LENGTH('dbo.users','import_tag') IS NULL ALTER TABLE dbo.users ADD import_tag VARCHAR(80) NULL`,
      `IF COL_LENGTH('dbo.employees','is_test') IS NULL ALTER TABLE dbo.employees ADD is_test BIT NOT NULL CONSTRAINT DF_employees_is_test DEFAULT 0`,
      `IF COL_LENGTH('dbo.employees','import_tag') IS NULL ALTER TABLE dbo.employees ADD import_tag VARCHAR(80) NULL`
    ])await new sql.Request(transaction).query(batch);
    const refs=await new sql.Request(transaction).query(`
      SELECT TOP 1 id AS roleId FROM roles WHERE role_code='employee';
      SELECT TOP 1 id AS branchId FROM branches WHERE branch_name LIKE N'%Vạn Kiếp%' AND status='active' ORDER BY id;
      SELECT TOP 1 id AS positionId FROM positions
        WHERE position_code='COUNTER' OR position_name=N'Nhân viên quầy' ORDER BY id;
      SELECT e.id AS employeeId,e.employee_code AS employeeCode,e.user_id AS userId,u.full_name AS fullName,u.email
      FROM employees e JOIN users u ON u.id=e.user_id`);
    const roleId=refs.recordsets[0][0]?.roleId,branchId=refs.recordsets[1][0]?.branchId,positionId=refs.recordsets[2][0]?.positionId;
    if(!roleId||!branchId||!positionId)throw new Error("Thiếu role employee, chi nhánh Vạn Kiếp hoặc vị trí Nhân viên quầy.");
    const existing=refs.recordsets[3];
    for(const person of people){
      const found=existing.find(item=>person.aliases.includes(normalize(item.fullName)));
      if(found){
        await new sql.Request(transaction).input("userId",sql.Int,found.userId).input("hash",sql.VarChar(255),passwordHash)
          .query("UPDATE users SET password_hash=@hash,status='active',updated_at=SYSDATETIME() WHERE id=@userId");
        await new sql.Request(transaction).input("employeeId",sql.Int,found.employeeId)
          .query("UPDATE employees SET status='working',updated_at=SYSDATETIME() WHERE id=@employeeId");
        mapped++;
        accounts.push({name:found.fullName,employeeCode:found.employeeCode,email:found.email,password:DEFAULT_PASSWORD,type:"Hồ sơ hiện có"});
        continue;
      }
      const duplicate=await new sql.Request(transaction).input("email",sql.VarChar(150),person.email).input("code",sql.VarChar(30),person.code)
        .query("SELECT TOP 1 id,full_name AS fullName,email FROM users WHERE email=@email; SELECT TOP 1 id,employee_code AS employeeCode,user_id AS userId FROM employees WHERE employee_code=@code");
      let userId=duplicate.recordsets[0][0]?.id;
      if(!userId){
        const user=await new sql.Request(transaction).input("roleId",sql.Int,roleId).input("name",sql.NVarChar(150),person.name)
          .input("email",sql.VarChar(150),person.email).input("hash",sql.VarChar(255),passwordHash).input("tag",sql.VarChar(80),IMPORT_TAG)
          .query(`INSERT users(role_id,full_name,email,password_hash,status,is_test,import_tag)
            OUTPUT INSERTED.id VALUES(@roleId,@name,@email,@hash,'active',1,@tag)`);
        userId=user.recordset[0].id;
      }else{
        await new sql.Request(transaction).input("userId",sql.Int,userId).input("hash",sql.VarChar(255),passwordHash)
          .query("UPDATE users SET password_hash=@hash,status='active',updated_at=SYSDATETIME() WHERE id=@userId");
      }
      const employee=duplicate.recordsets[1][0];
      if(!employee){
        await new sql.Request(transaction).input("userId",sql.Int,userId).input("branchId",sql.Int,branchId)
          .input("positionId",sql.Int,positionId).input("code",sql.VarChar(30),person.code).input("tag",sql.VarChar(80),IMPORT_TAG)
          .query(`INSERT employees(user_id,branch_id,position_id,employee_code,hire_date,status,is_test,import_tag)
            VALUES(@userId,@branchId,@positionId,@code,'2026-07-01','working',1,@tag)`);
        created++;
      }
      accounts.push({name:person.name,employeeCode:person.code,email:person.email,password:DEFAULT_PASSWORD,type:"Tài khoản kiểm thử"});
    }
    await transaction.commit();
    console.log(`Đã map hồ sơ hiện có: ${mapped}`);
    console.log(`Đã tạo nhân viên test: ${created}`);
    console.table(accounts);
  }catch(error){
    await transaction.rollback().catch(()=>{});
    throw error;
  }finally{await pool.close()}
})().catch(error=>{console.error("Tạo tài khoản thất bại:",error.message);process.exit(1)});
