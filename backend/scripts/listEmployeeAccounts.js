require("dotenv").config();
const {getPool}=require("../config/db");

(async()=>{
  const pool=await getPool();
  const result=await pool.request().query(`
    SELECT e.id AS employeeId,e.employee_code AS employeeCode,u.id AS userId,u.full_name AS fullName,
      u.email,u.phone,u.status AS accountStatus,e.status AS employeeStatus,
      p.position_name AS positionName,b.branch_name AS branchName,e.hire_date AS hireDate,
      e.birth_date AS birthDate,e.gender,e.address
    FROM employees e
    LEFT JOIN users u ON u.id=e.user_id
    LEFT JOIN positions p ON p.id=e.position_id
    LEFT JOIN branches b ON b.id=e.branch_id
    ORDER BY b.branch_name,u.full_name,e.employee_code`);
  console.table(result.recordset);
  await pool.close();
})().catch(error=>{console.error(error);process.exit(1)});
