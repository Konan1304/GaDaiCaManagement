const bcrypt=require('bcrypt');
const jwt=require('jsonwebtoken');
const {sql,getPool}=require('../config/db');
const {writeAudit}=require('../services/auditService');
const attempts=new Map(),MAX_ATTEMPTS=5,WINDOW_MS=15*60*1000;
const clientIp=req=>String(req.ip||req.socket?.remoteAddress||'').slice(0,64);

async function login(req,res,next){try{
  const email=String(req.body.email||'').trim().toLowerCase(),password=String(req.body.password||'');
  if(!email||!password)return res.status(400).json({success:false,message:'Email và mật khẩu là bắt buộc'});
  const key=`${clientIp(req)}|${email}`,now=Date.now(),entry=attempts.get(key);
  if(entry&&entry.until>now&&entry.count>=MAX_ATTEMPTS){res.set('Retry-After',String(Math.ceil((entry.until-now)/1000)));return res.status(429).json({success:false,message:'Bạn đã nhập sai quá nhiều lần. Vui lòng thử lại sau 15 phút.'})}
  if(entry&&entry.until<=now)attempts.delete(key);
  const pool=await getPool(),result=await pool.request().input('email',sql.VarChar(150),email).query('SELECT TOP 1 u.id,u.full_name,u.email,u.password_hash,u.status,r.role_code,r.role_name FROM users u JOIN roles r ON r.id=u.role_id WHERE u.email=@email');
  const user=result.recordset[0];
  if(!user||!(await bcrypt.compare(password,user.password_hash))){const current=attempts.get(key)||{count:0,until:now+WINDOW_MS};current.count+=1;attempts.set(key,current);await writeAudit(pool,{userId:user?.id||null,action:'LOGIN_FAILED',entityType:'user',entityId:user?.id,details:{email},ip:clientIp(req)});return res.status(401).json({success:false,message:'Email hoặc mật khẩu không đúng'})}
  if(user.status==='locked')return res.status(403).json({success:false,message:'Tài khoản đã bị khóa'});
  if(user.status==='inactive')return res.status(403).json({success:false,message:'Tài khoản đã ngừng hoạt động'});
  attempts.delete(key);const role=user.role_code.toLowerCase(),token=jwt.sign({userId:user.id,role,email:user.email},process.env.JWT_SECRET,{expiresIn:'8h'});
  await pool.request().input('id',sql.Int,user.id).query('UPDATE users SET last_login_at=SYSDATETIME(),updated_at=SYSDATETIME() WHERE id=@id');
  await writeAudit(pool,{userId:user.id,action:'LOGIN_SUCCESS',entityType:'user',entityId:user.id,ip:clientIp(req)});
  res.json({success:true,message:'Đăng nhập thành công',token,role,userId:user.id,fullName:user.full_name,redirectTo:role==='admin'?'/manager/dashboard':'/employee/home'});
}catch(error){next(error)}}

async function requestPasswordReset(req,res,next){try{
  const email=String(req.body.email||'').trim().toLowerCase();if(!email)return res.status(400).json({success:false,message:'Vui lòng nhập email'});
  const pool=await getPool(),found=await pool.request().input('email',sql.VarChar(150),email).query("SELECT TOP 1 id,full_name FROM users WHERE email=@email AND status<>'inactive'");const user=found.recordset[0];
  if(user){const active=await pool.request().input('uid',sql.Int,user.id).query("SELECT TOP 1 id FROM password_reset_requests WHERE user_id=@uid AND status='pending' AND created_at>DATEADD(MINUTE,-30,SYSDATETIME())");if(!active.recordset[0]){const created=await pool.request().input('uid',sql.Int,user.id).input('ip',sql.VarChar(64),clientIp(req)).query('INSERT password_reset_requests(user_id,requested_ip) OUTPUT INSERTED.id VALUES(@uid,@ip)');await pool.request().input('content',sql.NVarChar(1000),`${user.full_name} (${email}) yêu cầu đặt lại mật khẩu.`).input('ref',sql.BigInt,created.recordset[0].id).input('test',sql.Bit,process.env.APP_ENV==='sandbox'?1:0).query("INSERT notifications(user_id,notification_type,title,content,reference_type,reference_id,action_url,priority,is_test) SELECT u.id,'password_reset',N'Yêu cầu đặt lại mật khẩu',@content,'password_reset_request',@ref,N'/manager/employees','high',@test FROM users u JOIN roles r ON r.id=u.role_id WHERE LOWER(r.role_code)='admin' AND u.status='active'");await writeAudit(pool,{userId:user.id,action:'PASSWORD_RESET_REQUESTED',entityType:'password_reset_request',entityId:created.recordset[0].id,ip:clientIp(req)})}}
  res.json({success:true,message:'Nếu tài khoản tồn tại, yêu cầu đã được gửi đến quản trị viên. Vui lòng liên hệ quản trị viên để nhận mật khẩu mới.'});
}catch(error){next(error)}}
module.exports={login,requestPasswordReset};
