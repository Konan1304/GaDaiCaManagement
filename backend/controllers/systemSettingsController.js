const {sql,getPool}=require('../config/db');
const {writeAudit}=require('../services/auditService');
const allowed=['store_name','support_phone','head_office_address','timezone'];

async function get(req,res,next){try{
  const pool=await getPool(),result=await pool.request().query(`SELECT setting_key settingKey,setting_value settingValue,description,updated_at updatedAt FROM system_settings WHERE setting_key IN (${allowed.map(x=>`'${x}'`).join(',')})`);
  res.json({success:true,data:Object.fromEntries(result.recordset.map(x=>[x.settingKey,x.settingValue||'']))});
}catch(error){next(error)}}

async function update(req,res,next){try{
  const entries=allowed.filter(key=>Object.prototype.hasOwnProperty.call(req.body,key)).map(key=>[key,String(req.body[key]??'').trim()]);
  if(!entries.length)return res.status(400).json({success:false,message:'Không có cài đặt hợp lệ để lưu'});
  const pool=await getPool(),tx=new sql.Transaction(pool);await tx.begin();
  try{for(const [key,value] of entries)await new sql.Request(tx).input('key',sql.VarChar(100),key).input('value',sql.NVarChar(sql.MAX),value).input('uid',sql.Int,req.user.userId).query('UPDATE system_settings SET setting_value=@value,updated_by=@uid,updated_at=SYSDATETIME() WHERE setting_key=@key');await tx.commit()}catch(error){await tx.rollback();throw error}
  await writeAudit(pool,{userId:req.user.userId,action:'SETTINGS_UPDATE',entityType:'system_settings',details:{keys:entries.map(x=>x[0])},ip:req.ip});
  res.json({success:true,message:'Đã lưu cài đặt hệ thống'});
}catch(error){next(error)}}
async function auditLogs(req,res,next){try{const result=await (await getPool()).request().query("SELECT TOP 100 a.id,a.action,a.entity_type entityType,a.entity_id entityId,a.details_json detailsJson,a.ip_address ipAddress,a.created_at createdAt,u.full_name actorName FROM admin_audit_logs a LEFT JOIN users u ON u.id=a.user_id ORDER BY a.id DESC");res.json({success:true,data:result.recordset})}catch(error){next(error)}}
module.exports={get,update,auditLogs};
