const { getPool } = require("../config/db");
const BaseModel = require("./BaseModel");

const aliases = {
  schedules:"employee_schedules", attendance:"attendance_logs", imports:"purchase_receipts",
  import_details:"purchase_receipt_items", cash_reports:"shift_closing_reports", settings:"system_settings",
};

let registry;
async function loadModels() {
  if (registry) return registry;
  const pool=await getPool();
  const result=await pool.request().query(`
    SELECT t.name AS tableName,c.name AS columnName,c.is_identity AS isIdentity,c.is_computed AS isComputed,
           CASE WHEN pk.column_id IS NULL THEN 0 ELSE 1 END AS isPrimaryKey
    FROM sys.tables t
    INNER JOIN sys.columns c ON c.object_id=t.object_id
    LEFT JOIN (SELECT ic.object_id,ic.column_id FROM sys.indexes i INNER JOIN sys.index_columns ic ON ic.object_id=i.object_id AND ic.index_id=i.index_id WHERE i.is_primary_key=1) pk ON pk.object_id=c.object_id AND pk.column_id=c.column_id
    WHERE SCHEMA_NAME(t.schema_id)='dbo'
    ORDER BY t.name,c.column_id
  `);
  const grouped={};
  for(const column of result.recordset)(grouped[column.tableName]??=[]).push(column);
  registry=Object.fromEntries(Object.entries(grouped).map(([table,schema])=>[table,new BaseModel(table,schema)]));
  for(const [alias,table] of Object.entries(aliases)) if(registry[table]) registry[alias]=registry[table];
  return registry;
}

async function getModel(name){const models=await loadModels();const model=models[name];if(!model)throw Object.assign(new Error(`Model ${name} không tồn tại trong SQL Server`),{statusCode:404});return model}
module.exports={loadModels,getModel,aliases};
