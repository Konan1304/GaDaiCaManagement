require("dotenv").config();
const fs=require("fs");
const path=require("path");
const {connectDatabase}=require("../config/db");

(async()=>{
  const pool=await connectDatabase();
  const script=fs.readFileSync(path.join(__dirname,"../../database/migrations/20260725_manager_attendance.sql"),"utf8");
  for(const batch of script.split(/^\s*GO\s*$/gim).map(value=>value.trim()).filter(Boolean)){
    await pool.request().batch(batch);
  }
  console.log("Migration quản lý chấm công đã hoàn thành.");
  await pool.close();
})().catch(error=>{console.error(error);process.exit(1)});
