require("dotenv").config();
const fs=require("fs");
const path=require("path");
const {getPool}=require("../config/db");

(async()=>{
  const pool=await getPool();
  const source=fs.readFileSync(path.join(__dirname,"../../database/migrations/20260725_attendance_sessions.sql"),"utf8");
  for(const batch of source.split(/^\s*GO\s*$/gim).filter(Boolean))await pool.request().batch(batch);
  console.log("Migration chấm công theo ca đã hoàn tất.");
  await pool.close();
})().catch(error=>{console.error(error);process.exit(1)});
