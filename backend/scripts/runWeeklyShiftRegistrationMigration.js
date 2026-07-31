require("dotenv").config();
const fs=require("fs");
const path=require("path");
const {getPool}=require("../config/db");
(async()=>{
 const pool=await getPool();
 const source=fs.readFileSync(path.join(__dirname,"../../database/migrations/20260731_weekly_shift_registration.sql"),"utf8");
 for(const batch of source.split(/^\s*GO\s*$/gim).filter(value=>value.trim()))await pool.request().batch(batch);
 console.log("Migration bảng đăng ký ca theo tuần hoàn tất.");
 await pool.close();
})().catch(error=>{console.error(error);process.exit(1)});
