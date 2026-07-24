require("dotenv").config();
const bcrypt = require("bcrypt");
const { sql, getPool } = require("../config/db");

async function seed() {
  const pool = await getPool();
  const transaction = new sql.Transaction(pool);
  const adminHash = await bcrypt.hash("123456", 12);
  const cashierHash = await bcrypt.hash("123456", 12);

  try {
    await transaction.begin();

    const roleRequest = new sql.Request(transaction);
    const roles = await roleRequest.query(`
      SELECT id, role_code FROM roles WHERE role_code IN ('admin', 'employee')
    `);
    const roleMap = Object.fromEntries(roles.recordset.map(role => [role.role_code, role.id]));
    if (!roleMap.admin || !roleMap.employee) throw new Error("Thiếu role admin hoặc employee");

    const positionRequest = new sql.Request(transaction);
    const positions = await positionRequest.query(`
      SELECT id, position_code FROM positions WHERE position_code IN ('MANAGER', 'CASHIER', 'KITCHEN')
    `);
    const positionMap = Object.fromEntries(positions.recordset.map(position => [position.position_code, position.id]));
    if (!positionMap.MANAGER || !positionMap.CASHIER || !positionMap.KITCHEN) {
      throw new Error("Thiếu vị trí MANAGER, CASHIER hoặc KITCHEN");
    }

    const branchResult = await new sql.Request(transaction)
      .input("code", sql.VarChar(30), "CNQ10")
      .input("name", sql.NVarChar(150), "Gà Đại Ca - Chi nhánh Quận 10")
      .input("address", sql.NVarChar(300), "Quận 10, Thành phố Hồ Chí Minh")
      .query(`
        IF NOT EXISTS (SELECT 1 FROM branches WHERE branch_code=@code OR branch_name=@name)
          INSERT INTO branches(branch_code,branch_name,address,status)
          VALUES(@code,@name,@address,'active');
        SELECT TOP 1 id FROM branches WHERE branch_code=@code OR branch_name=@name ORDER BY id;
      `);
    const branchId = branchResult.recordset[0].id;

    async function upsertUser({ email, fullName, roleId, passwordHash }) {
      const result = await new sql.Request(transaction)
        .input("email", sql.VarChar(150), email)
        .input("fullName", sql.NVarChar(150), fullName)
        .input("roleId", sql.Int, roleId)
        .input("passwordHash", sql.VarChar(255), passwordHash)
        .query(`
          IF EXISTS (SELECT 1 FROM users WHERE email=@email)
            UPDATE users SET full_name=@fullName,role_id=@roleId,password_hash=@passwordHash,
              status='active',updated_at=SYSDATETIME() WHERE email=@email;
          ELSE
            INSERT INTO users(role_id,full_name,email,password_hash,status)
            VALUES(@roleId,@fullName,@email,@passwordHash,'active');
          SELECT id FROM users WHERE email=@email;
        `);
      return result.recordset[0].id;
    }

    const adminUserId = await upsertUser({
      email: "admin@daiga.vn",
      fullName: "Quản trị viên Gà Đại Ca",
      roleId: roleMap.admin,
      passwordHash: adminHash,
    });
    const cashierUserId = await upsertUser({
      email: "cashier@daiga.vn",
      fullName: "Nhân viên Thu ngân",
      roleId: roleMap.employee,
      passwordHash: cashierHash,
    });

    async function upsertEmployee({ userId, positionId, employeeCode }) {
      await new sql.Request(transaction)
        .input("userId", sql.Int, userId)
        .input("branchId", sql.Int, branchId)
        .input("positionId", sql.Int, positionId)
        .input("employeeCode", sql.VarChar(30), employeeCode)
        .query(`
          IF EXISTS (SELECT 1 FROM employees WHERE user_id=@userId)
            UPDATE employees SET branch_id=@branchId,position_id=@positionId,status='working',
              updated_at=SYSDATETIME() WHERE user_id=@userId;
          ELSE
            INSERT INTO employees(user_id,branch_id,position_id,employee_code,hire_date,status)
            VALUES(@userId,@branchId,@positionId,@employeeCode,CAST(GETDATE() AS date),'working');
        `);
    }

    await upsertEmployee({ userId: adminUserId, positionId: positionMap.MANAGER, employeeCode: "ADMIN001" });
    await upsertEmployee({ userId: cashierUserId, positionId: positionMap.CASHIER, employeeCode: "CASHIER001" });

    await transaction.commit();
    console.log("Seed dữ liệu khởi tạo thành công");
  } catch (error) {
    await transaction.rollback().catch(() => {});
    throw error;
  } finally {
    await pool.close();
  }
}

seed().catch(error => {
  console.error("Seed thất bại:", error.message);
  process.exit(1);
});
