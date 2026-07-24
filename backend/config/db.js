const sql = require("mssql/msnodesqlv8");

const server = process.env.DB_SERVER || "localhost";
const database = process.env.DB_DATABASE || "GaDaiCaManagement";
const encrypt = String(process.env.DB_ENCRYPT).toLowerCase() === "true";
const trustServerCertificate = String(process.env.DB_TRUST_SERVER_CERTIFICATE).toLowerCase() !== "false";

const config = {
  connectionString: [
    "Driver={ODBC Driver 17 for SQL Server}",
    `Server={${server}}`,
    `Database={${database}}`,
    "Trusted_Connection={yes}",
    `Encrypt={${encrypt ? "yes" : "no"}}`,
    `TrustServerCertificate={${trustServerCertificate ? "yes" : "no"}}`,
  ].join(";"),
  pool: { max: 10, min: 0, idleTimeoutMillis: 30000 },
  requestTimeout: 30000,
};

let poolPromise;

function connectDatabase() {
  if (!poolPromise) {
    poolPromise = new sql.ConnectionPool(config).connect().then((pool) => {
      console.log(`Kết nối SQL Server thành công: ${server}/${database}`);
      pool.on("error", (error) => console.error("SQL pool error:", error.message));
      return pool;
    }).catch((error) => {
      poolPromise = null;
      throw error;
    });
  }
  return poolPromise;
}

async function getPool() { return connectDatabase(); }

module.exports = { sql, config, connectDatabase, getPool };
