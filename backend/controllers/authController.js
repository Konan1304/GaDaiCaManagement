const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { sql, getPool } = require("../config/db");

async function login(req, res, next) {
  try {
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = String(req.body.password || "");
    if (!email || !password) return res.status(400).json({ success:false, message:"Email và mật khẩu là bắt buộc" });

    const pool = await getPool();
    const result = await pool.request().input("email", sql.VarChar(150), email).query(`
      SELECT TOP 1 u.id, u.full_name, u.email, u.password_hash, u.status,
             r.role_code, r.role_name
      FROM users u
      INNER JOIN roles r ON r.id = u.role_id
      WHERE u.email = @email
    `);
    const user = result.recordset[0];
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({ success:false, message:"Email hoặc mật khẩu không đúng" });
    }
    if (user.status === "locked") return res.status(403).json({ success:false, message:"Tài khoản đã bị khóa" });
    if (user.status === "inactive") return res.status(403).json({ success:false, message:"Tài khoản đã ngừng hoạt động" });

    const role = user.role_code.toLowerCase();
    const token = jwt.sign({ userId:user.id, role, email:user.email }, process.env.JWT_SECRET, { expiresIn:"8h" });
    await pool.request().input("id", sql.Int, user.id).query("UPDATE users SET last_login_at = SYSDATETIME(), updated_at = SYSDATETIME() WHERE id = @id");
    const redirectTo = role === "admin" ? "/manager/dashboard" : "/employee/home";
    return res.json({ success:true, message:"Đăng nhập thành công", token, role, userId:user.id, fullName:user.full_name, redirectTo });
  } catch (error) { return next(error); }
}

module.exports = { login };
