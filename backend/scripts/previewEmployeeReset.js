require("dotenv").config();
const {getPool}=require("../config/db");

(async()=>{
  const pool=await getPool();
  const result=await pool.request().query(`
    SELECT e.id AS employeeId,e.employee_code AS employeeCode,u.id AS userId,u.email,u.full_name AS fullName,r.role_name AS roleName
    FROM employees e
    JOIN users u ON u.id=e.user_id
    JOIN roles r ON r.id=u.role_id
    ORDER BY CASE WHEN r.role_name='admin' THEN 0 ELSE 1 END,u.full_name;

    SELECT
      OBJECT_SCHEMA_NAME(fk.parent_object_id)+'.'+OBJECT_NAME(fk.parent_object_id) AS childTable,
      pc.name AS childColumn,
      OBJECT_SCHEMA_NAME(fk.referenced_object_id)+'.'+OBJECT_NAME(fk.referenced_object_id) AS parentTable,
      rc.name AS parentColumn
    FROM sys.foreign_keys fk
    JOIN sys.foreign_key_columns fkc ON fkc.constraint_object_id=fk.object_id
    JOIN sys.columns pc ON pc.object_id=fk.parent_object_id AND pc.column_id=fkc.parent_column_id
    JOIN sys.columns rc ON rc.object_id=fk.referenced_object_id AND rc.column_id=fkc.referenced_column_id
    WHERE OBJECT_NAME(fk.referenced_object_id) IN ('employees','users','employee_schedules','shift_sessions','orders','payrolls')
    ORDER BY parentTable,childTable;
  `);
  console.table(result.recordsets[0]);
  console.table(result.recordsets[1]);
  await pool.close();
})().catch(error=>{console.error(error);process.exit(1)});
