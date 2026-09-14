const fs=require('fs');
const path=require('path');
process.env.APP_ENV='production';
require('../config/env').loadEnvironment('production');
const {getPool}=require('../config/db');

(async()=>{
  const pool=await getPool();
  try{
    const source=fs.readFileSync(path.resolve(__dirname,'../../database/20260905_import_three_branches_employees.sql'),'utf8');
    for(const batch of source.split(/^\s*GO\s*$/gim).filter(Boolean))await pool.request().batch(batch);
    const result=await pool.request().query(`
      SELECT COUNT(*) total,
        SUM(CASE WHEN e.identity_number IS NOT NULL THEN 1 ELSE 0 END) withIdentity,
        SUM(CASE WHEN e.bank_account_number IS NOT NULL THEN 1 ELSE 0 END) withBank
      FROM employees e WHERE e.employee_code IN
      ('NV001','NV002','GVV001','GVV002','GVV003','GVV004','GVV005','GVV006','GVV007','GVV008','GVV009','GVV0010','GSM002',
       'GVK001','GVK002','GVK003','GVK004','GVK005','GVK006','GVK007','GVK008','GVK0011',
       'GGV001','GGV002','GGV003','GGV004','GGV005','GGV006','GGV007','GGV008');
    `);
    console.log('Kết quả nhập hồ sơ:',result.recordset[0]);
  }finally{await pool.close()}
})().catch(error=>{console.error('Nhập hồ sơ thất bại:',error.message);process.exit(1)});
