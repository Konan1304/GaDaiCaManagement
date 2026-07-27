require("dotenv").config();
const fs=require("fs");
const path=require("path");
const {getPool}=require("../config/db");
(async()=>{const pool=await getPool();const file=path.join(__dirname,"../../database/migrations/20260728_purchase_imports_module.sql");
 const batches=fs.readFileSync(file,"utf8").split(/^\s*GO\s*$/gim).filter(x=>x.trim());
 for(const batch of batches)await pool.request().batch(batch);
 console.log("Migration module Nhập hàng hoàn tất.");await pool.close();
})().catch(error=>{console.error(error);process.exit(1)});
