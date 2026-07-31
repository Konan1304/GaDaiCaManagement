const sql = require("mssql/msnodesqlv8");
const { loadEnvironment } = require("./env");
loadEnvironment();

const server = process.env.DB_SERVER;
const database = process.env.DB_DATABASE;
const encrypt = String(process.env.DB_ENCRYPT).toLowerCase() === "true";
const trustServerCertificate = String(process.env.DB_TRUST_SERVER_CERTIFICATE).toLowerCase() !== "false";
const config = {
  connectionString: ["Driver={ODBC Driver 17 for SQL Server}", `Server={${server}}`, `Database={${database}}`, "Trusted_Connection={yes}", `Encrypt={${encrypt ? "yes" : "no"}}`, `TrustServerCertificate={${trustServerCertificate ? "yes" : "no"}}`].join(";"),
  pool: { max: 10, min: 0, idleTimeoutMillis: 30000 },
  requestTimeout: 30000,
};

let poolPromise;
function connectDatabase() {
  if (!poolPromise) {
    poolPromise = new sql.ConnectionPool(config).connect().then(async (pool) => {
      const result = await pool.request().query("SELECT DB_NAME() AS database_name");
      const actualDatabase = result.recordset[0]?.database_name;
      const isTestDatabase = /_Test$/i.test(actualDatabase || "");
      if (actualDatabase !== database) throw new Error(`Database thực tế (${actualDatabase}) khác cấu hình (${database})`);
      if (process.env.APP_ENV === "sandbox" && !isTestDatabase) throw new Error("TỪ CHỐI KHỞI ĐỘNG: Sandbox đang kết nối database Production");
      if (process.env.APP_ENV === "production" && isTestDatabase) throw new Error("TỪ CHỐI KHỞI ĐỘNG: Production đang kết nối database Sandbox");
      console.log(`Kết nối SQL Server thành công [${process.env.APP_ENV}]: ${server}/${actualDatabase}`);
      pool.on("error", (error) => console.error("SQL pool error:", error.message));
      return pool;
    }).catch((error) => { poolPromise = null; throw error; });
  }
  return poolPromise;
}
async function getPool() { return connectDatabase(); }
module.exports = { sql, config, connectDatabase, getPool };
