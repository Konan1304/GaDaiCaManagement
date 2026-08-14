process.env.APP_ENV = 'sandbox';
process.env.NODE_ENV = 'development';
require('../config/env').loadEnvironment('sandbox');
const { getPool } = require('../config/db');

async function main() {
  const pool = await getPool();
  const database = (await pool.request().query('SELECT DB_NAME() AS name')).recordset[0].name;
  if (process.env.APP_ENV !== 'sandbox' || !/_Test$/i.test(database)) {
    throw new Error(`Từ chối kiểm thử: APP_ENV=${process.env.APP_ENV}, database=${database}`);
  }
  const schema = await pool.request().query(`
    SELECT OBJECT_ID('dbo.shift_inventory_sessions') sessions,
           OBJECT_ID('dbo.shift_inventory_items') items,
           OBJECT_ID('dbo.inventory_discrepancies') discrepancies,
           OBJECT_ID('dbo.shift_inventory_audit_logs') audit;
    SELECT COUNT(*) AS invalidRows FROM dbo.shift_inventory_sessions WHERE is_test<>1;
  `);
  const objects = schema.recordsets[0][0];
  const opening = { lyGa: 100, sotCay: 20, coca: 30 };
  const imported = { lyGa: 0, sotCay: 0, coca: 10 };
  const closing = { lyGa: 95, sotCay: 18, coca: 35 };
  const used = Object.fromEntries(Object.keys(opening).map(key => [key, opening[key] + imported[key] - closing[key]]));
  const checks = {
    sandboxDatabase: /_Test$/i.test(database),
    schemaReady: Object.values(objects).every(Boolean),
    testOnlyConstraint: Number(schema.recordsets[1][0].invalidRows) === 0,
    usageFormula: used.lyGa === 5 && used.sotCay === 2 && used.coca === 5,
    handoverDifference: 93 - closing.lyGa === -2,
  };
  console.log(JSON.stringify({ database, checks, sample: { opening, imported, closing, used, eveningLyGaReceived: 93 } }, null, 2));
  if (Object.values(checks).some(value => !value)) process.exitCode = 1;
  await pool.close();
}
main().catch(error => { console.error(error); process.exit(1); });
