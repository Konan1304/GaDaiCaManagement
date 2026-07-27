require("dotenv").config();
const fs=require("fs");
const path=require("path");
const {getPool}=require("../config/db");
(async()=>{
 const sql=fs.readFileSync(path.join(__dirname,"../../database/migrations/20260728_suppliers_module.sql"),"utf8");
 const pool=await getPool();await pool.request().batch(sql);console.log("Migration module Nhà cung cấp đã hoàn thành.");await pool.close();
})().catch(error=>{console.error(error);process.exit(1)});
