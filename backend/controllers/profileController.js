const { sql, getPool } = require("../config/db");

async function getProfile(req, res, next) {
  try {
    const pool = await getPool();
    const result = await pool.request().input("userId", sql.Int, req.user.userId).query(`
      SELECT u.id AS userId, u.full_name AS fullName, u.email, u.phone, u.avatar_url AS avatarUrl,
             u.status, r.role_code AS role,
             e.id AS employeeId, e.employee_code AS employeeCode, e.hire_date AS hireDate,
             e.status AS employeeStatus, p.position_name AS position,
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

module.exports = { getProfile };
