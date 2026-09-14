const fs = require("fs");
const path = require("path");

const backendRoot = path.join(__dirname, "..", "backend");
require(path.join(backendRoot, "config", "env")).loadEnvironment("production");
const { getPool } = require(path.join(backendRoot, "config", "db"));

const selectedTables = [
  "attendance_logs",
  "branches",
  "employee_schedules",
  "employees",
  "payrolls",
  "positions",
  "shifts",
  "users"
];

const quotedTables = selectedTables.map(name => `'${name.replaceAll("'", "''")}'`).join(",");

(async () => {
  const pool = await getPool();
  try {
    const columnsResult = await pool.request().query(`
      SELECT
        t.name AS tableName,
        c.column_id AS ordinal,
        c.name AS columnName,
        ty.name AS dataType,
        c.max_length AS maxLength,
        c.precision AS numericPrecision,
        c.scale AS numericScale,
        c.is_nullable AS isNullable,
        CASE WHEN pk.column_id IS NULL THEN 0 ELSE 1 END AS isPrimaryKey,
        CASE WHEN fk.parent_column_id IS NULL THEN 0 ELSE 1 END AS isForeignKey
      FROM sys.tables t
      JOIN sys.columns c ON c.object_id=t.object_id
      JOIN sys.types ty ON ty.user_type_id=c.user_type_id
      LEFT JOIN (
        SELECT ic.object_id,ic.column_id
        FROM sys.indexes i
        JOIN sys.index_columns ic ON ic.object_id=i.object_id AND ic.index_id=i.index_id
        WHERE i.is_primary_key=1
      ) pk ON pk.object_id=t.object_id AND pk.column_id=c.column_id
      LEFT JOIN (
        SELECT DISTINCT parent_object_id,parent_column_id
        FROM sys.foreign_key_columns
      ) fk ON fk.parent_object_id=t.object_id AND fk.parent_column_id=c.column_id
      WHERE t.name IN (${quotedTables})
      ORDER BY t.name,c.column_id;
    `);

    const relationsResult = await pool.request().query(`
      SELECT
        fk.name AS constraintName,
        childTable.name AS childTable,
        childColumn.name AS childColumn,
        parentTable.name AS parentTable,
        parentColumn.name AS parentColumn
      FROM sys.foreign_keys fk
      JOIN sys.foreign_key_columns fkc ON fkc.constraint_object_id=fk.object_id
      JOIN sys.tables childTable ON childTable.object_id=fkc.parent_object_id
      JOIN sys.columns childColumn ON childColumn.object_id=fkc.parent_object_id AND childColumn.column_id=fkc.parent_column_id
      JOIN sys.tables parentTable ON parentTable.object_id=fkc.referenced_object_id
      JOIN sys.columns parentColumn ON parentColumn.object_id=fkc.referenced_object_id AND parentColumn.column_id=fkc.referenced_column_id
      WHERE childTable.name IN (${quotedTables}) AND parentTable.name IN (${quotedTables})
      ORDER BY childTable.name,fk.name,fkc.constraint_column_id;
    `);

    const tables = selectedTables.map(name => ({
      name,
      columns: columnsResult.recordset.filter(column => column.tableName === name)
    }));
    const snapshot = {
      database: process.env.DB_DATABASE,
      generatedAt: new Date().toISOString(),
      tables,
      relations: relationsResult.recordset
    };
    const outputPath = path.join(__dirname, "chapter3_assets", "Hinh_3_7_schema_snapshot.json");
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, JSON.stringify(snapshot, null, 2), "utf8");
    console.log(`Đã đọc ${tables.length} bảng và ${snapshot.relations.length} khóa ngoại từ ${snapshot.database}.`);
    console.log(outputPath);
  } finally {
    await pool.close();
  }
})().catch(error => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
