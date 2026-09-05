const { sql, getPool } = require("../config/db");
async function ensurePersonalColumns(pool){await pool.request().batch(`
 IF COL_LENGTH('dbo.employees','identity_number') IS NULL ALTER TABLE dbo.employees ADD identity_number VARCHAR(20) NULL;
 IF COL_LENGTH('dbo.employees','identity_issue_date') IS NULL ALTER TABLE dbo.employees ADD identity_issue_date DATE NULL;
 IF COL_LENGTH('dbo.employees','identity_issue_place') IS NULL ALTER TABLE dbo.employees ADD identity_issue_place NVARCHAR(200) NULL;
 IF COL_LENGTH('dbo.employees','bank_account_number') IS NULL ALTER TABLE dbo.employees ADD bank_account_number VARCHAR(50) NULL;
 IF COL_LENGTH('dbo.employees','bank_name') IS NULL ALTER TABLE dbo.employees ADD bank_name NVARCHAR(100) NULL;
 IF COL_LENGTH('dbo.employees','bank_branch') IS NULL ALTER TABLE dbo.employees ADD bank_branch NVARCHAR(200) NULL;
 IF COL_LENGTH('dbo.employees','profile_submitted_at') IS NULL ALTER TABLE dbo.employees ADD profile_submitted_at DATETIME2 NULL;
 IF COL_LENGTH('dbo.employees','profile_update_locked') IS NULL ALTER TABLE dbo.employees ADD profile_update_locked BIT NOT NULL CONSTRAINT DF_employees_profile_update_locked DEFAULT 0;
 IF COL_LENGTH('dbo.employees','employment_type') IS NULL ALTER TABLE dbo.employees ADD employment_type VARCHAR(20) NULL;`)}

async function getProfile(req, res, next) {
  try {
    const pool = await getPool();
    await ensurePersonalColumns(pool);
    const result = await pool.request().input("userId", sql.Int, req.user.userId).query(`
      SELECT u.id AS userId, u.full_name AS fullName, u.email, u.phone, u.avatar_url AS avatarUrl,
             u.status, r.role_code AS role,
             e.id AS employeeId, e.employee_code AS employeeCode, e.hire_date AS hireDate,e.employment_type AS employmentType,
             e.birth_date AS birthDate,e.gender,e.address,e.identity_number AS identityNumber,
             e.identity_issue_date AS identityIssueDate,e.identity_issue_place AS identityIssuePlace,
             e.bank_account_number AS bankAccountNumber,e.bank_name AS bankName,e.bank_branch AS bankBranch,
             e.profile_submitted_at AS profileSubmittedAt,e.profile_update_locked AS profileUpdateLocked,e.status AS employeeStatus, p.position_name AS position,
             b.id AS branchId, b.branch_name AS branchName, b.address AS branchAddress
      FROM users u
      INNER JOIN roles r ON r.id = u.role_id
      LEFT JOIN employees e ON e.user_id = u.id
      LEFT JOIN positions p ON p.id = e.position_id
      LEFT JOIN branches b ON b.id = e.branch_id
      WHERE u.id = @userId
    `);
    if (!result.recordset[0]) return res.status(404).json({ success:false, message:"Không tìm thấy hồ sơ" });
    return res.json({ success:true, data:result.recordset[0] });
  } catch (error) { return next(error); }
}

const clean=value=>String(value??"").trim();
async function updateAvatar(req,res,next){try{
  if(!req.file)return res.status(400).json({success:false,message:"Vui lòng chọn ảnh đại diện"});
  const pool=await getPool();await ensurePersonalColumns(pool);
  const employee=await pool.request().input("uid",sql.Int,req.user.userId).query("SELECT profile_update_locked AS profileUpdateLocked FROM employees WHERE user_id=@uid");
  if(employee.recordset[0]?.profileUpdateLocked)return res.status(403).json({success:false,message:"Admin đã khóa quyền cập nhật hồ sơ"});
  const avatarUrl=`${req.protocol}://${req.get("host")}/uploads/profiles/${req.file.filename}`;
  const result=await pool.request().input("uid",sql.Int,req.user.userId).input("avatar",sql.NVarChar(500),avatarUrl).query("UPDATE users SET avatar_url=@avatar,updated_at=SYSDATETIME() OUTPUT INSERTED.avatar_url AS avatarUrl WHERE id=@uid");
  if(!result.recordset[0])return res.status(404).json({success:false,message:"Không tìm thấy tài khoản"});
  return res.json({success:true,message:"Cập nhật ảnh đại diện thành công",data:result.recordset[0]});
}catch(error){next(error)}}
async function updatePersonalProfile(req,res,next){try{
  const body=req.body||{},identity=clean(body.identityNumber),phone=clean(body.phone),bankAccount=clean(body.bankAccountNumber);
  if(phone&&!/^\d{8,15}$/.test(phone))return res.status(400).json({success:false,message:"Số điện thoại không hợp lệ"});
  if(identity&&!/^\d{9,12}$/.test(identity))return res.status(400).json({success:false,message:"Số CCCD không hợp lệ"});
  if(bankAccount&&!/^[0-9]{6,30}$/.test(bankAccount))return res.status(400).json({success:false,message:"Số tài khoản ngân hàng không hợp lệ"});
  const pool=await getPool();await ensurePersonalColumns(pool);const tx=new sql.Transaction(pool);let begun=false;try{await tx.begin();begun=true;
    const found=await new sql.Request(tx).input("uid",sql.Int,req.user.userId).query("SELECT e.id employeeId,e.branch_id branchId,e.profile_update_locked profileUpdateLocked,u.full_name fullName,e.employee_code employeeCode FROM employees e JOIN users u ON u.id=e.user_id WHERE e.user_id=@uid AND e.status='working'");
    const employee=found.recordset[0];if(!employee){await tx.rollback();return res.status(404).json({success:false,message:"Không tìm thấy hồ sơ nhân viên"})}
    if(employee.profileUpdateLocked){await tx.rollback();return res.status(403).json({success:false,message:"Admin đã khóa quyền cập nhật hồ sơ"})}
    await new sql.Request(tx).input("uid",sql.Int,req.user.userId).input("phone",sql.VarChar(20),phone||null).query("UPDATE users SET phone=@phone,updated_at=SYSDATETIME() WHERE id=@uid");
    await new sql.Request(tx).input("id",sql.Int,employee.employeeId).input("birth",sql.Date,body.birthDate||null).input("gender",sql.VarChar(10),["male","female","other"].includes(body.gender)?body.gender:null).input("address",sql.NVarChar(300),clean(body.address)||null).input("identity",sql.VarChar(20),identity||null).input("issueDate",sql.Date,body.identityIssueDate||null).input("issuePlace",sql.NVarChar(200),clean(body.identityIssuePlace)||null).input("account",sql.VarChar(50),bankAccount||null).input("bank",sql.NVarChar(100),clean(body.bankName)||null).input("bankBranch",sql.NVarChar(200),clean(body.bankBranch)||null).query("UPDATE employees SET birth_date=@birth,gender=@gender,address=@address,identity_number=@identity,identity_issue_date=@issueDate,identity_issue_place=@issuePlace,bank_account_number=@account,bank_name=@bank,bank_branch=@bankBranch,profile_submitted_at=SYSDATETIME(),updated_at=SYSDATETIME() WHERE id=@id");
    await new sql.Request(tx).input("branch",sql.Int,employee.branchId).input("employeeId",sql.Int,employee.employeeId).input("content",sql.NVarChar(1000),`${employee.fullName} (${employee.employeeCode}) vừa gửi thông tin hồ sơ cá nhân.`).query("INSERT notifications(user_id,notification_type,title,content,reference_type,reference_id) SELECT DISTINCT u.id,'employee_profile_submitted',N'Nhân viên cập nhật hồ sơ',@content,'employee',@employeeId FROM users u JOIN roles r ON r.id=u.role_id LEFT JOIN employees e ON e.user_id=u.id WHERE u.status='active' AND (r.role_code='admin' OR (r.role_code='manager' AND e.branch_id=@branch))");
    await tx.commit();begun=false;return res.json({success:true,message:"Đã gửi thông tin hồ sơ lên Admin"});
  }catch(error){if(begun)await tx.rollback().catch(()=>{});throw error}
}catch(error){next(error)}}

module.exports = { getProfile,updatePersonalProfile,updateAvatar };
