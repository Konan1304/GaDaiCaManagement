const environment = process.argv[2];
process.env.APP_ENV = environment;
require("../config/env").loadEnvironment(environment);
const { connect, runMigrations } = require("./dbTools");
(async () => { const pool = await connect(); try { const applied = await runMigrations(pool); console.log(applied.length ? `Đã chạy: ${applied.join(", ")}` : "Schema đã ở phiên bản mới nhất"); } finally { await pool.close(); } })().catch((error) => { console.error("Migration thất bại:", error.message); process.exit(1); });
