const bcrypt = require("bcrypt");
const { sql, getPool } = require("../config/db");

const employeeSelect = `
  SELECT e.id,e.user_id AS userId,e.employee_code AS employeeCode,u.full_name AS fullName,
    u.email,u.phone,r.role_code AS roleCode,r.role_name AS roleName,e.branch_id AS branchId,
    b.branch_code AS branchCode,b.branch_name AS branchName,e.position_id AS positionId,
    p.position_code AS positionCode,p.position_name AS positionName,e.birth_date AS birthDate,
    e.gender,e.address,e.hire_date AS hireDate,e.base_salary AS baseSalary,
    e.status AS employeeStatus,u.status AS accountStatus,u.avatar_url AS avatarUrl,
    e.created_at AS createdAt,e.updated_at AS updatedAt
  FROM employees e
  INNER JOIN users u ON u.id=e.user_id
  INNER JOIN roles r ON r.id=u.role_id
  INNER JOIN branches b ON b.id=e.branch_id
  INNER JOIN positions p ON p.id=e.position_id`;
const emailPattern=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const datePattern=/^\d{4}-\d{2}-\d{2}$/;
const employeeStatuses=["working","on_leave","resigned"],accountStatuses=["active","inactive","locked"],genders=["male","female","other"];
const clean=value=>String(value??"").trim();
const fail=(res,status,message,field)=>res.status(status).json({success:false,message,field});

async function validateReferences(request,branchId,positionId,roleCode,actorRole){
  const result=await request.input("branchId",sql.Int,branchId).input("positionId",sql.Int,positionId)
    .input("roleCode",sql.VarChar(30),roleCode).query(`
      SELECT id,status FROM branches WHERE id=@branchId;
      SELECT id FROM positions WHERE id=@positionId;
      SELECT id,role_code AS roleCode FROM roles WHERE role_code=@roleCode;
    `);
  if(!result.recordsets[0][0]||result.recordsets[0][0].status!=="active")return {field:"branchId",message:"Chi nhánh không tồn tại hoặc đã ngừng hoạt động"};
  if(!result.recordsets[1][0])return {field:"positionId",message:"Vị trí không tồn tại"};
  const role=result.recordsets[2][0];
  if(!role)return {field:"roleCode",message:"Quyền tài khoản không hợp lệ"};
  if(role.roleCode!=="employee"&&actorRole!=="admin")return {field:"roleCode",message:"Bạn không có quyền cấp vai trò này"};
  if(!["employee","manager","admin"].includes(role.roleCode))return {field:"roleCode",message:"Quyền tài khoản không được phép"};
  return {roleId:role.id};
}

async function list(req,res,next){try{
  const page=Math.max(1,Number.parseInt(req.query.page)||1),limit=Math.min(100,Math.max(1,Number.parseInt(req.query.limit)||10)),offset=(page-1)*limit;
  const request=(await getPool()).request().input("offset",sql.Int,offset).input("limit",sql.Int,limit);
  let scopedBranchId=req.query.branchId?Number(req.query.branchId):null;
  if(req.user.role==="manager"){
    const manager=await (await getPool()).request().input("userId",sql.Int,req.user.userId).query("SELECT branch_id AS branchId FROM employees WHERE user_id=@userId");
    if(!manager.recordset[0])return fail(res,403,"Tài khoản quản lý chưa được gán chi nhánh");
    if(scopedBranchId&&scopedBranchId!==Number(manager.recordset[0].branchId))return fail(res,403,"Bạn không được truy cập chi nhánh này");
    scopedBranchId=Number(manager.recordset[0].branchId);
  }
  if(scopedBranchId){
    const branch=await (await getPool()).request().input("branchId",sql.Int,scopedBranchId).query("SELECT id FROM branches WHERE id=@branchId");
    if(!branch.recordset[0])return fail(res,404,"Không tìm thấy chi nhánh");
    req.query.branchId=scopedBranchId;
  }
  const where=[],filters=[["branchId","e.branch_id",sql.Int],["positionId","e.position_id",sql.Int],["employeeStatus","e.status",sql.VarChar(20)],["accountStatus","u.status",sql.VarChar(20)]];
  for(const [key,column,type] of filters)if(req.query[key]){where.push(`${column}=@${key}`);request.input(key,type,req.query[key])}
  if(clean(req.query.search)){where.push("(u.full_name LIKE @search OR u.email LIKE @search OR e.employee_code LIKE @search OR u.phone LIKE @search)");request.input("search",sql.NVarChar(180),`%${clean(req.query.search)}%`)}
  const clause=where.length?` WHERE ${where.join(" AND ")}`:"";
  const result=await request.query(`${employeeSelect}${clause} ORDER BY e.created_at DESC OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY; SELECT COUNT(*) AS total FROM employees e INNER JOIN users u ON u.id=e.user_id${clause};`);
  const total=result.recordsets[1][0].total;
  res.json({success:true,data:result.recordsets[0],pagination:{page,limit,total,totalPages:Math.ceil(total/limit)}});
}catch(error){next(error)}}

async function detail(req,res,next){try{const result=await (await getPool()).request().input("id",sql.Int,req.params.id).query(`${employeeSelect} WHERE e.id=@id`);if(!result.recordset[0])return fail(res,404,"Không tìm thấy nhân viên");res.status(req.created?201:200).json({success:true,data:result.recordset[0]})}catch(error){next(error)}}

function validatePayload(body,creating){
  const required=["fullName","email","employeeCode","hireDate","branchId","positionId"];
  if(creating)required.push("password");
  for(const field of required)if(!clean(body[field]))return {field,message:"Trường này là bắt buộc"};
  if(!emailPattern.test(clean(body.email)))return {field:"email",message:"Email không hợp lệ"};
  if(creating&&clean(body.password).length<6)return {field:"password",message:"Mật khẩu phải có ít nhất 6 ký tự"};
  if(body.birthDate&&!datePattern.test(body.birthDate))return {field:"birthDate",message:"Ngày sinh không hợp lệ"};
  if(!datePattern.test(body.hireDate))return {field:"hireDate",message:"Ngày vào làm không hợp lệ"};
  if(body.gender&&!genders.includes(body.gender))return {field:"gender",message:"Giới tính không hợp lệ"};
  if(!Number.isInteger(Number(body.branchId)))return {field:"branchId",message:"Chi nhánh không hợp lệ"};
  if(!Number.isInteger(Number(body.positionId)))return {field:"positionId",message:"Vị trí không hợp lệ"};
  if(Number(body.baseSalary||0)<0)return {field:"baseSalary",message:"Lương cơ bản không hợp lệ"};
  if(body.employeeStatus&&!employeeStatuses.includes(body.employeeStatus))return {field:"employeeStatus",message:"Trạng thái nhân viên không hợp lệ"};
  if(body.accountStatus&&!accountStatuses.includes(body.accountStatus))return {field:"accountStatus",message:"Trạng thái tài khoản không hợp lệ"};
  return null;
}

async function create(req,res,next){const pool=await getPool(),transaction=new sql.Transaction(pool);let started=false;try{
  const body=req.body,error=validatePayload(body,true);if(error)return fail(res,400,error.message,error.field);
  if(req.user.role==="manager"){const manager=await pool.request().input("userId",sql.Int,req.user.userId).query("SELECT branch_id AS branchId FROM employees WHERE user_id=@userId");if(!manager.recordset[0]||Number(body.branchId)!==Number(manager.recordset[0].branchId))return fail(res,403,"Bạn chỉ được thêm nhân viên vào chi nhánh của mình")}
  if(body.confirmPassword!==undefined&&body.password!==body.confirmPassword)return fail(res,400,"Mật khẩu xác nhận không khớp","confirmPassword");
  const roleCode=clean(body.roleCode)||"employee";
  await transaction.begin();started=true;
  const request=new sql.Request(transaction);
  const refs=await validateReferences(request,Number(body.branchId),Number(body.positionId),roleCode,req.user.role);
  if(refs.message){await transaction.rollback();started=false;return fail(res,400,refs.message,refs.field)}
  const duplicate=await new sql.Request(transaction).input("email",sql.VarChar(150),clean(body.email).toLowerCase()).input("code",sql.VarChar(30),clean(body.employeeCode)).query("SELECT id FROM users WHERE email=@email; SELECT id FROM employees WHERE employee_code=@code;");
  if(duplicate.recordsets[0][0]){await transaction.rollback();started=false;return fail(res,409,"Email đã được sử dụng","email")}
  if(duplicate.recordsets[1][0]){await transaction.rollback();started=false;return fail(res,409,"Mã nhân viên đã tồn tại","employeeCode")}
  const hash=await bcrypt.hash(body.password,10);
  const user=await new sql.Request(transaction).input("roleId",sql.Int,refs.roleId).input("name",sql.NVarChar(150),clean(body.fullName))
    .input("email",sql.VarChar(150),clean(body.email).toLowerCase()).input("password",sql.VarChar(255),hash)
    .input("phone",sql.VarChar(20),clean(body.phone)||null).query("INSERT INTO users(role_id,full_name,email,password_hash,phone,status) OUTPUT INSERTED.id VALUES(@roleId,@name,@email,@password,@phone,'active')");
  const employee=await new sql.Request(transaction).input("userId",sql.Int,user.recordset[0].id).input("branchId",sql.Int,body.branchId).input("positionId",sql.Int,body.positionId)
    .input("code",sql.VarChar(30),clean(body.employeeCode)).input("birthDate",sql.Date,body.birthDate||null).input("gender",sql.VarChar(10),body.gender||null)
    .input("address",sql.NVarChar(300),clean(body.address)||null).input("hireDate",sql.Date,body.hireDate).input("salary",sql.Decimal(18,2),Number(body.baseSalary||0))
    .query("INSERT INTO employees(user_id,branch_id,position_id,employee_code,birth_date,gender,address,hire_date,base_salary,status) OUTPUT INSERTED.id VALUES(@userId,@branchId,@positionId,@code,@birthDate,@gender,@address,@hireDate,@salary,'working')");
  await transaction.commit();started=false;req.params.id=employee.recordset[0].id;req.created=true;return detail(req,res,next);
}catch(error){if(started)await transaction.rollback().catch(()=>{});next(error)}}

async function update(req,res,next){const pool=await getPool(),transaction=new sql.Transaction(pool);let started=false;try{
  const body=req.body,error=validatePayload(body,false);if(error)return fail(res,400,error.message,error.field);
  if(req.user.role==="manager"){const manager=await pool.request().input("userId",sql.Int,req.user.userId).query("SELECT branch_id AS branchId FROM employees WHERE user_id=@userId");if(!manager.recordset[0]||Number(body.branchId)!==Number(manager.recordset[0].branchId))return fail(res,403,"Bạn chỉ được quản lý nhân viên trong chi nhánh của mình")}
  await transaction.begin();started=true;
  const current=await new sql.Request(transaction).input("id",sql.Int,req.params.id).query("SELECT e.user_id AS userId FROM employees e WHERE e.id=@id");
  if(!current.recordset[0]){await transaction.rollback();started=false;return fail(res,404,"Không tìm thấy nhân viên")}
  const refs=await validateReferences(new sql.Request(transaction),Number(body.branchId),Number(body.positionId),"employee",req.user.role);
  if(refs.message){await transaction.rollback();started=false;return fail(res,400,refs.message,refs.field)}
  const duplicate=await new sql.Request(transaction).input("email",sql.VarChar(150),clean(body.email).toLowerCase()).input("userId",sql.Int,current.recordset[0].userId).query("SELECT id FROM users WHERE email=@email AND id<>@userId");
  if(duplicate.recordset[0]){await transaction.rollback();started=false;return fail(res,409,"Email đã được sử dụng","email")}
  await new sql.Request(transaction).input("userId",sql.Int,current.recordset[0].userId).input("name",sql.NVarChar(150),clean(body.fullName)).input("email",sql.VarChar(150),clean(body.email).toLowerCase()).input("phone",sql.VarChar(20),clean(body.phone)||null).input("avatar",sql.NVarChar(500),clean(body.avatarUrl)||null).input("accountStatus",sql.VarChar(20),body.accountStatus||"active").query("UPDATE users SET full_name=@name,email=@email,phone=@phone,avatar_url=@avatar,status=@accountStatus,updated_at=SYSDATETIME() WHERE id=@userId");
  await new sql.Request(transaction).input("id",sql.Int,req.params.id).input("branchId",sql.Int,body.branchId).input("positionId",sql.Int,body.positionId).input("birthDate",sql.Date,body.birthDate||null).input("gender",sql.VarChar(10),body.gender||null).input("address",sql.NVarChar(300),clean(body.address)||null).input("hireDate",sql.Date,body.hireDate).input("salary",sql.Decimal(18,2),Number(body.baseSalary||0)).input("status",sql.VarChar(20),body.employeeStatus||"working").query("UPDATE employees SET branch_id=@branchId,position_id=@positionId,birth_date=@birthDate,gender=@gender,address=@address,hire_date=@hireDate,base_salary=@salary,status=@status,updated_at=SYSDATETIME() WHERE id=@id");
  await transaction.commit();started=false;return detail(req,res,next);
}catch(error){if(started)await transaction.rollback().catch(()=>{});next(error)}}

async function accountStatus(req,res,next){const status=clean(req.body.status);if(!accountStatuses.includes(status))return fail(res,400,"Trạng thái tài khoản không hợp lệ","status");const pool=await getPool(),transaction=new sql.Transaction(pool);let started=false;try{await transaction.begin();started=true;const result=await new sql.Request(transaction).input("id",sql.Int,req.params.id).input("status",sql.VarChar(20),status).query("UPDATE u SET u.status=@status,u.updated_at=SYSDATETIME() OUTPUT INSERTED.id FROM users u INNER JOIN employees e ON e.user_id=u.id WHERE e.id=@id");if(!result.recordset[0]){await transaction.rollback();started=false;return fail(res,404,"Không tìm thấy nhân viên")}await transaction.commit();started=false;res.json({success:true,message:status==="active"?"Đã mở tài khoản":"Đã cập nhật trạng thái tài khoản"})}catch(error){if(started)await transaction.rollback().catch(()=>{});next(error)}}
async function resetPassword(req,res,next){const password=clean(req.body.newPassword);if(password.length<6)return fail(res,400,"Mật khẩu phải có ít nhất 6 ký tự","newPassword");const pool=await getPool(),transaction=new sql.Transaction(pool);let started=false;try{const hash=await bcrypt.hash(password,10);await transaction.begin();started=true;const result=await new sql.Request(transaction).input("id",sql.Int,req.params.id).input("hash",sql.VarChar(255),hash).query("UPDATE u SET u.password_hash=@hash,u.updated_at=SYSDATETIME() OUTPUT INSERTED.id FROM users u INNER JOIN employees e ON e.user_id=u.id WHERE e.id=@id");if(!result.recordset[0]){await transaction.rollback();started=false;return fail(res,404,"Không tìm thấy nhân viên")}await transaction.commit();started=false;res.json({success:true,message:"Đặt lại mật khẩu thành công"})}catch(error){if(started)await transaction.rollback().catch(()=>{});next(error)}}
async function resign(req,res,next){const pool=await getPool(),transaction=new sql.Transaction(pool);let started=false;try{await transaction.begin();started=true;const result=await new sql.Request(transaction).input("id",sql.Int,req.params.id).query("UPDATE e SET e.status='resigned',e.updated_at=SYSDATETIME() OUTPUT INSERTED.id FROM employees e WHERE e.id=@id; UPDATE u SET u.status='inactive',u.updated_at=SYSDATETIME() FROM users u INNER JOIN employees e ON e.user_id=u.id WHERE e.id=@id;");if(!result.recordsets[0][0]){await transaction.rollback();started=false;return fail(res,404,"Không tìm thấy nhân viên")}await transaction.commit();started=false;res.json({success:true,message:"Đã cập nhật nhân viên nghỉ việc"})}catch(error){if(started)await transaction.rollback().catch(()=>{});next(error)}}
async function branches(req,res,next){try{const result=await (await getPool()).request().query("SELECT id,branch_code AS branchCode,branch_name AS branchName,phone,address,status FROM branches WHERE status='active' ORDER BY branch_name");res.json({success:true,data:result.recordset})}catch(error){next(error)}}
async function positions(req,res,next){try{const result=await (await getPool()).request().query("SELECT id,position_code AS positionCode,position_name AS positionName FROM positions ORDER BY position_name");res.json({success:true,data:result.recordset})}catch(error){next(error)}}

async function employeeBranches(req,res,next){try{
  const pool=await getPool(),request=pool.request(),where=[];
  if(req.user.role==="manager"){
    const manager=await pool.request().input("userId",sql.Int,req.user.userId).query("SELECT branch_id AS branchId FROM employees WHERE user_id=@userId");
    if(!manager.recordset[0])return fail(res,403,"Tài khoản quản lý chưa được gán chi nhánh");
    where.push("b.id=@managerBranchId");request.input("managerBranchId",sql.Int,manager.recordset[0].branchId);
  }
  if(clean(req.query.search)){where.push("(b.branch_name COLLATE Latin1_General_CI_AI LIKE @search OR b.branch_code COLLATE Latin1_General_CI_AI LIKE @search OR b.address COLLATE Latin1_General_CI_AI LIKE @search)");request.input("search",sql.NVarChar(200),`%${clean(req.query.search)}%`)}
  if(["active","inactive"].includes(req.query.status)){where.push("b.status=@status");request.input("status",sql.VarChar(20),req.query.status)}
  const clause=where.length?`WHERE ${where.join(" AND ")}`:"";
  const result=await request.query(`
    SELECT b.id AS branchId,b.branch_code AS branchCode,b.branch_name AS branchName,b.phone,b.address,b.status,
      COUNT(DISTINCT e.id) AS totalEmployees,
      COUNT(DISTINCT CASE WHEN e.status='working' THEN e.id END) AS workingEmployees,
      COUNT(DISTINCT CASE WHEN e.status='resigned' THEN e.id END) AS resignedEmployees,
      COUNT(DISTINCT CASE WHEN u.status IN ('locked','inactive') THEN e.id END) AS lockedAccounts
    FROM branches b LEFT JOIN employees e ON e.branch_id=b.id LEFT JOIN users u ON u.id=e.user_id
    ${clause}
    GROUP BY b.id,b.branch_code,b.branch_name,b.phone,b.address,b.status
    ORDER BY CASE WHEN b.status='active' THEN 0 ELSE 1 END,b.branch_name;
  `);
  res.json({success:true,data:result.recordset});
}catch(error){next(error)}}

async function employeeScope(req,res,next){try{
  if(req.user.role==="admin")return next();
  const result=await (await getPool()).request().input("userId",sql.Int,req.user.userId).input("employeeId",sql.Int,req.params.id).query(`
    SELECT me.branch_id AS managerBranchId,target.branch_id AS targetBranchId
    FROM employees me CROSS JOIN employees target
    WHERE me.user_id=@userId AND target.id=@employeeId
  `);
  if(!result.recordset[0])return fail(res,404,"Không tìm thấy nhân viên");
  if(Number(result.recordset[0].managerBranchId)!==Number(result.recordset[0].targetBranchId))return fail(res,403,"Bạn không được quản lý nhân viên thuộc chi nhánh khác");
  next();
}catch(error){next(error)}}

async function createBranch(req,res,next){try{
  const branchCode=clean(req.body.branchCode).toUpperCase(),branchName=clean(req.body.branchName);
  if(!branchCode)return fail(res,400,"Mã chi nhánh là bắt buộc","branchCode");
  if(!branchName)return fail(res,400,"Tên chi nhánh là bắt buộc","branchName");
  const result=await (await getPool()).request().input("code",sql.VarChar(30),branchCode)
    .input("name",sql.NVarChar(150),branchName).input("phone",sql.VarChar(20),clean(req.body.phone)||null)
    .input("address",sql.NVarChar(300),clean(req.body.address)||null).query(`
      IF EXISTS(SELECT 1 FROM branches WHERE branch_code=@code)
        THROW 50001,N'Mã chi nhánh đã tồn tại',1;
      INSERT INTO branches(branch_code,branch_name,phone,address,status)
      OUTPUT INSERTED.id,INSERTED.branch_code AS branchCode,INSERTED.branch_name AS branchName,
        INSERTED.phone,INSERTED.address,INSERTED.status
      VALUES(@code,@name,@phone,@address,'active');
    `);
  res.status(201).json({success:true,message:"Thêm chi nhánh thành công",data:result.recordset[0]});
}catch(error){if(error.number===50001)return fail(res,409,"Mã chi nhánh đã tồn tại","branchCode");next(error)}}

async function updateBranchName(req,res,next){try{
  const branchName=clean(req.body.branchName),branchId=Number(req.params.id);
  if(!Number.isInteger(branchId)||branchId<=0)return fail(res,400,"Chi nhánh không hợp lệ","branchId");
  if(!branchName)return fail(res,400,"Tên chi nhánh là bắt buộc","branchName");
  if(branchName.length>150)return fail(res,400,"Tên chi nhánh không được quá 150 ký tự","branchName");
  const request=(await getPool()).request().input("id",sql.Int,branchId).input("name",sql.NVarChar(150),branchName);
  let scope="";
  if(req.user.role!=="admin"){
    request.input("userId",sql.Int,req.user.userId);
    scope=" AND EXISTS(SELECT 1 FROM employees e WHERE e.user_id=@userId AND e.branch_id=branches.id)";
  }
  const result=await request.query(`UPDATE branches SET branch_name=@name
    OUTPUT INSERTED.id AS branchId,INSERTED.branch_name AS branchName WHERE id=@id${scope}`);
  if(!result.recordset[0])return fail(res,404,"Không tìm thấy chi nhánh hoặc bạn không có quyền đổi tên");
  res.json({success:true,message:"Đổi tên chi nhánh thành công",data:result.recordset[0]});
}catch(error){next(error)}}

async function remove(req,res,next){
 const pool=await getPool(),transaction=new sql.Transaction(pool);let started=false;
 try{
  await transaction.begin();started=true;
  const current=await new sql.Request(transaction).input("id",sql.Int,req.params.id)
    .query("SELECT id,user_id AS userId FROM employees WITH(UPDLOCK) WHERE id=@id");
  const employee=current.recordset[0];
  if(!employee){await transaction.rollback();started=false;return fail(res,404,"Không tìm thấy nhân viên")}
  if(Number(employee.userId)===Number(req.user.userId)){await transaction.rollback();started=false;return fail(res,409,"Bạn không thể xóa tài khoản đang đăng nhập")}
  await new sql.Request(transaction).input("id",sql.Int,employee.id).query("DELETE FROM employees WHERE id=@id");
  await new sql.Request(transaction).input("userId",sql.Int,employee.userId).query("DELETE FROM users WHERE id=@userId");
  await transaction.commit();started=false;
  res.json({success:true,message:"Đã xóa nhân viên và tài khoản"});
 }catch(error){
  if(started)await transaction.rollback().catch(()=>{});
  if(error.number===547)return fail(res,409,"Nhân viên đã có dữ liệu lịch sử nên không thể xóa. Hãy dùng chức năng Cho nghỉ việc để bảo toàn dữ liệu.");
  next(error);
 }
}

module.exports={list,detail,create,update,accountStatus,resetPassword,resign,branches,positions,createBranch,updateBranchName,remove,employeeBranches,employeeScope};
