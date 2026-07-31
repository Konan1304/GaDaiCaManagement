const environment = process.argv[2];
process.env.APP_ENV = environment;
process.env.NODE_ENV = environment === "production" ? "production" : "development";
try {
  require("../config/env").loadEnvironment(environment);
  require("../server");
} catch (error) {
  console.error(`Không thể khởi động ${environment || "unknown"}:`, error.message);
  process.exit(1);
}
