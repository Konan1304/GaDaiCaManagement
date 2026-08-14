const {sql}=require("../config/db");

async function businessNow(executor){
  if(process.env.APP_ENV==="sandbox"){
    const result=await executor.request().query("SELECT business_datetime AS businessDateTime,CONVERT(char(10),business_datetime,23) AS businessDate,CONVERT(char(8),business_datetime,108) AS businessTime FROM dbo.sandbox_clock WHERE id=1");
    if(!result.recordset[0])throw new Error("Sandbox BusinessClock chưa được khởi tạo");
    return result.recordset[0];
  }
  const result=await executor.request().query("SELECT SYSDATETIME() AS businessDateTime,CONVERT(char(10),SYSDATETIME(),23) AS businessDate,CONVERT(char(8),SYSDATETIME(),108) AS businessTime");
  return result.recordset[0];
}

async function setBusinessNow(pool,value,userId){
  if(process.env.APP_ENV!=="sandbox"||!/_Test$/i.test(process.env.DB_DATABASE||""))throw Object.assign(new Error("Từ chối thay đổi BusinessClock ngoài Sandbox"),{status:403});
  if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?$/.test(String(value||"")))throw Object.assign(new Error("Ngày giờ nghiệp vụ không hợp lệ"),{status:400});
  await pool.request().input("value",sql.DateTime2,new Date(`${value}${value.length===16?":00":""}Z`)).input("userId",sql.Int,userId).query("UPDATE dbo.sandbox_clock SET business_datetime=@value,updated_by=@userId,updated_at=SYSDATETIME() WHERE id=1");
  return businessNow(pool);
}
module.exports={businessNow,setBusinessNow};
