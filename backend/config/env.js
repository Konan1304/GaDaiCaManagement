const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");

let loaded;
function loadEnvironment(explicitEnvironment) {
  if (loaded) return loaded;
  const appEnv = String(explicitEnvironment || process.env.APP_ENV || "").trim().toLowerCase();
  if (!["production", "sandbox"].includes(appEnv)) throw new Error("APP_ENV phải là production hoặc sandbox");
  const envPath = path.resolve(__dirname, `../.env.${appEnv}`);
  if (!fs.existsSync(envPath)) throw new Error(`Thiếu file cấu hình ${envPath}`);
  const result = dotenv.config({ path: envPath, override: true });
  if (result.error) throw result.error;
  process.env.APP_ENV = appEnv;
  const required = ["PORT", "DB_SERVER", "DB_DATABASE", "JWT_SECRET", "CORS_ORIGIN"];
  const missing = required.filter((key) => !String(process.env[key] || "").trim());
  if (missing.length) throw new Error(`Thiếu biến môi trường: ${missing.join(", ")}`);
  const database = process.env.DB_DATABASE.trim();
  const isTestDatabase = /_Test$/i.test(database);
  if (appEnv === "sandbox" && !isTestDatabase) throw new Error(`Sandbox chỉ được dùng database có hậu tố _Test (đang cấu hình: ${database})`);
  if (appEnv === "production" && isTestDatabase) throw new Error(`Production không được dùng database _Test (đang cấu hình: ${database})`);
  loaded = { appEnv, envPath, database };
  return loaded;
}
module.exports = { loadEnvironment };
