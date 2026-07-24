require("dotenv").config();
const fs=require("fs");
const path=require("path");
const {getPool}=require("../config/db");
(async()=>{const pool=await getPool(),sql=fs.readFileSync(path.join(__dirname,"../../database/migrations/20260725_flexible_registration_periods.sql"),"utf8");for(const batch of sql.split(/^\s*GO\s*$/gim).filter(Boolean))await pool.request().batch(batch);console.log("Migration khoảng đăng ký linh hoạt đã hoàn tất.");await pool.close()})().catch(error=>{console.error(error);process.exit(1)});
