const {sql,getPool}=require("../config/db"),{employeeFromJwt}=require("../services/shiftEligibilityService");const fail=(r,s,m)=>r.status(s).json({success:false,message:m});
const isTestEnv=()=>(process.env.APP_ENV==='sandbox'?1:0);
async function branch(req,p){const e=await employeeFromJwt(p,req.user.userId);return req.user.role==='admin'?null:e?.branchId}
async function channels(req,res,next){try{
  const isTest=isTestEnv(),p=await getPool(),b=await branch(req,p),q=p.request().input("isTest",sql.Bit,isTest);
  await p.request().input('isTest',sql.Bit,isTest).query(`
    DECLARE @types TABLE(channel_type VARCHAR(20),label NVARCHAR(80));
    INSERT @types VALUES('GENERAL',N'Trao đổi chung'),('INCIDENT',N'Báo cáo vệ sinh'),('INVENTORY',N'Báo cáo hàng hóa');
    UPDATE c SET c.name=t.label+N' - '+b.branch_name,c.is_active=1,c.is_test=@isTest
    FROM chat_channels c JOIN branches b ON b.id=c.branch_id JOIN @types t ON t.channel_type=c.channel_type;
    INSERT chat_channels(branch_id,channel_type,name,is_system,is_active,is_test)
    SELECT b.id,t.channel_type,t.label+N' - '+b.branch_name,1,1,@isTest
    FROM branches b CROSS JOIN @types t WHERE b.status='active' AND NOT EXISTS(SELECT 1 FROM chat_channels c WHERE c.branch_id=b.id AND c.channel_type=t.channel_type)`);
  if(b)q.input("b",sql.Int,b);
  const r=await q.query(`SELECT c.id channelId,c.branch_id branchId,b.branch_name branchName,b.branch_code branchCode,c.channel_type channelType,c.name,(SELECT COUNT(*) FROM chat_messages m WHERE m.channel_id=c.id AND m.is_deleted=0 AND m.is_test=@isTest AND m.id>COALESCE((SELECT last_read_message_id FROM chat_read_states rs WHERE rs.channel_id=c.id AND rs.user_id=${Number(req.user.userId)}),0)) unreadCount FROM chat_channels c JOIN branches b ON b.id=c.branch_id WHERE c.is_active=1 AND c.is_test=@isTest${b?' AND c.branch_id=@b':''} ORDER BY b.branch_name,CASE c.channel_type WHEN 'GENERAL' THEN 1 WHEN 'INCIDENT' THEN 2 WHEN 'INVENTORY' THEN 3 ELSE 4 END`);
  res.json({success:true,data:r.recordset})
}catch(e){next(e)}}

async function createChannel(req,res,next){try{
  if(!['admin','manager'].includes(req.user.role))return fail(res,403,'Bạn không có quyền tạo cuộc trò chuyện');
  const p=await getPool(),employeeBranch=await branch(req,p),branchId=employeeBranch||Number(req.body.branchId),name=String(req.body.name||'').trim();
  if(!branchId)return fail(res,400,'Vui lòng chọn chi nhánh');
  if(name.length<2||name.length>150)return fail(res,400,'Tên cuộc trò chuyện phải từ 2 đến 150 ký tự');
  const valid=await p.request().input('branch',sql.Int,branchId).query("SELECT id FROM branches WHERE id=@branch AND status='active'");
  if(!valid.recordset[0])return fail(res,400,'Chi nhánh không hợp lệ');
  const duplicate=await p.request().input('branch',sql.Int,branchId).input('name',sql.NVarChar(150),name).input('isTest',sql.Bit,isTestEnv()).query("SELECT id FROM chat_channels WHERE branch_id=@branch AND name=@name AND is_active=1 AND is_test=@isTest");
  if(duplicate.recordset[0])return fail(res,409,'Chi nhánh đã có cuộc trò chuyện tên này');
  const result=await p.request().input('branch',sql.Int,branchId).input('name',sql.NVarChar(150),name).input('isTest',sql.Bit,isTestEnv()).query("INSERT chat_channels(branch_id,channel_type,name,is_system,is_active,is_test) OUTPUT INSERTED.id channelId VALUES(@branch,'CUSTOM',@name,0,1,@isTest)");
  res.status(201).json({success:true,message:'Đã tạo cuộc trò chuyện',data:result.recordset[0]});
}catch(e){next(e)}}

async function allowed(req,p,id){
  const isTest=isTestEnv(),b=await branch(req,p),r=await p.request().input("id",sql.Int,id).input("isTest",sql.Bit,isTest).query("SELECT TOP 1 id,branch_id branchId FROM chat_channels WHERE id=@id AND is_active=1 AND is_test=@isTest");
  const c=r.recordset[0];return c&&(req.user.role==='admin'||Number(c.branchId)===Number(b))?c:null
}

async function messages(req,res,next){try{
  const isTest=isTestEnv(),p=await getPool(),c=await allowed(req,p,+req.params.id);
  if(!c)return fail(res,403,"Không có quyền xem kênh");
  const page=Math.max(1,+req.query.page||1),size=Math.min(50,Math.max(1,+req.query.pageSize||30)),r=await p.request().input("id",sql.Int,c.id).input("offset",sql.Int,(page-1)*size).input("size",sql.Int,size).input("isTest",sql.Bit,isTest).query("SELECT m.id messageId,m.sender_user_id senderUserId,m.message_type messageType,m.content,m.reply_to_id replyToId,m.action_url actionUrl,CONVERT(varchar(23),m.created_at,126) createdAt,u.full_name senderName,u.avatar_url senderAvatarUrl FROM chat_messages m LEFT JOIN users u ON u.id=m.sender_user_id WHERE m.channel_id=@id AND m.is_deleted=0 AND m.is_test=@isTest ORDER BY m.id DESC OFFSET @offset ROWS FETCH NEXT @size ROWS ONLY");
  res.json({success:true,data:r.recordset.reverse(),pagination:{page,pageSize:size}})
}catch(e){next(e)}}

async function send(req,res,next){try{
  const isTest=isTestEnv(),text=String(req.body.content||'').trim();
  if(!text||text.length>2000)return fail(res,400,"Nội dung không hợp lệ");
  const p=await getPool(),c=await allowed(req,p,+req.params.id);
  if(!c)return fail(res,403,"Không có quyền gửi vào kênh");
  let reply=req.body.replyToId?Number(req.body.replyToId):null;
  if(reply){
    const x=await p.request().input("id",sql.BigInt,reply).input("channel",sql.Int,c.id).input("isTest",sql.Bit,isTest).query("SELECT id FROM chat_messages WHERE id=@id AND channel_id=@channel AND is_deleted=0 AND is_test=@isTest");
    if(!x.recordset[0])return fail(res,400,"Tin nhắn trả lời không hợp lệ")
  }
  const r=await p.request().input("channel",sql.Int,c.id).input("uid",sql.Int,req.user.userId).input("reply",sql.BigInt,reply).input("text",sql.NVarChar(2000),text).input("isTest",sql.Bit,isTest).query("INSERT chat_messages(channel_id,sender_user_id,reply_to_id,message_type,content,is_test) OUTPUT INSERTED.id messageId VALUES(@channel,@uid,@reply,'user',@text,@isTest)");
  res.status(201).json({success:true,message:"Đã gửi",data:r.recordset[0]})
}catch(e){next(e)}}

async function read(req,res,next){try{
  const isTest=isTestEnv(),p=await getPool(),c=await allowed(req,p,+req.params.id);
  if(!c)return fail(res,403,"Không có quyền");
  const last=await p.request().input("id",sql.Int,c.id).input("isTest",sql.Bit,isTest).query("SELECT MAX(id) id FROM chat_messages WHERE channel_id=@id AND is_deleted=0 AND is_test=@isTest");
  await p.request().input("channel",sql.Int,c.id).input("uid",sql.Int,req.user.userId).input("last",sql.BigInt,last.recordset[0].id).query("MERGE chat_read_states t USING(SELECT @channel channel_id,@uid user_id)s ON t.channel_id=s.channel_id AND t.user_id=s.user_id WHEN MATCHED THEN UPDATE SET last_read_message_id=@last,read_at=SYSDATETIME() WHEN NOT MATCHED THEN INSERT(channel_id,user_id,last_read_message_id) VALUES(@channel,@uid,@last);");
  res.json({success:true})
}catch(e){next(e)}}

async function remove(req,res,next){try{
  const isTest=isTestEnv(),p=await getPool(),r=await p.request().input("id",sql.BigInt,req.params.id).input("uid",sql.Int,req.user.userId).input("isTest",sql.Bit,isTest).query(`UPDATE chat_messages SET is_deleted=1,deleted_by=@uid,deleted_at=SYSDATETIME() WHERE id=@id AND is_test=@isTest AND (sender_user_id=@uid OR ${req.user.role==='admin'?1:0}=1);SELECT @@ROWCOUNT n`);
  if(!Number(r.recordset[0].n))return fail(res,403,"Không thể xóa tin nhắn");
  res.json({success:true})
}catch(e){next(e)}}

module.exports={channels,createChannel,messages,send,read,remove};
