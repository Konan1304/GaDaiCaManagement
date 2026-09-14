const {sql}=require('../config/db');

async function writeAudit(pool,{userId=null,action,entityType=null,entityId=null,details=null,ip=null}){
  try{
    await pool.request().input('uid',sql.Int,userId).input('action',sql.VarChar(100),action).input('type',sql.VarChar(80),entityType).input('entityId',sql.VarChar(80),entityId==null?null:String(entityId)).input('details',sql.NVarChar(sql.MAX),details?JSON.stringify(details):null).input('ip',sql.VarChar(64),ip).query('INSERT dbo.admin_audit_logs(user_id,action,entity_type,entity_id,details_json,ip_address) VALUES(@uid,@action,@type,@entityId,@details,@ip)');
  }catch(error){if(error.number!==208)console.error('Không ghi được nhật ký quản trị:',error.message)}
}
module.exports={writeAudit};
