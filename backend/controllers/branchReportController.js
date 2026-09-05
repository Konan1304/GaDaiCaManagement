const {sql,getPool}=require('../config/db');
const {employeeFromJwt}=require('../services/shiftEligibilityService');
const fail=(res,status,message)=>res.status(status).json({success:false,message});
const clean=value=>String(value??'').trim();

async function scope(req,pool){
  if(req.user.role==='admin')return 0;
  const employee=await employeeFromJwt(pool,req.user.userId);
  return Number(employee?.branchId||0);
}

async function list(req,res,next){try{
  const pool=await getPool(),branchScope=await scope(req,pool),type=clean(req.query.type).toUpperCase();
  const branchId=branchScope||Number(req.query.branchId||0),from=clean(req.query.from),to=clean(req.query.to);
  const request=pool.request();const where=[];
  if(branchId){request.input('branch',sql.Int,branchId);where.push('r.branch_id=@branch')}
  if(['HYGIENE','GOODS'].includes(type)){request.input('type',sql.VarChar(20),type);where.push('r.report_type=@type')}
  if(from){request.input('from',sql.Date,from);where.push('r.report_date>=@from')}
  if(to){request.input('to',sql.Date,to);where.push('r.report_date<=@to')}
  const result=await request.query(`SELECT r.id,r.branch_id branchId,b.branch_name branchName,b.branch_code branchCode,r.report_type reportType,CONVERT(char(10),r.report_date,23) reportDate,r.title,r.content,r.score,r.status,r.created_at createdAt,u.full_name createdBy,rv.full_name reviewedBy FROM branch_operational_reports r JOIN branches b ON b.id=r.branch_id JOIN users u ON u.id=r.created_by LEFT JOIN users rv ON rv.id=r.reviewed_by ${where.length?'WHERE '+where.join(' AND '):''} ORDER BY r.report_date DESC,r.id DESC`);
  res.json({success:true,data:result.recordset});
}catch(error){next(error)}}

async function create(req,res,next){try{
  const pool=await getPool(),branchScope=await scope(req,pool),branchId=branchScope||Number(req.body.branchId),type=clean(req.body.reportType).toUpperCase(),title=clean(req.body.title),content=clean(req.body.content),score=req.body.score===''||req.body.score==null?null:Number(req.body.score);
  if(!branchId)return fail(res,400,'Vui lòng chọn chi nhánh');
  if(!['HYGIENE','GOODS'].includes(type))return fail(res,400,'Loại báo cáo không hợp lệ');
  if(!title||!content)return fail(res,400,'Tiêu đề và nội dung là bắt buộc');
  if(score!==null&&(!Number.isInteger(score)||score<0||score>100))return fail(res,400,'Điểm đánh giá phải từ 0 đến 100');
  const result=await pool.request().input('branch',sql.Int,branchId).input('type',sql.VarChar(20),type).input('date',sql.Date,req.body.reportDate||new Date()).input('title',sql.NVarChar(200),title).input('content',sql.NVarChar(2000),content).input('score',sql.TinyInt,score).input('uid',sql.Int,req.user.userId).query("INSERT branch_operational_reports(branch_id,report_type,report_date,title,content,score,created_by) OUTPUT INSERTED.id VALUES(@branch,@type,@date,@title,@content,@score,@uid)");
  res.status(201).json({success:true,message:'Đã gửi báo cáo',data:result.recordset[0]});
}catch(error){next(error)}}

async function review(req,res,next){try{
  if(!['admin','manager'].includes(req.user.role))return fail(res,403,'Bạn không có quyền duyệt báo cáo');
  const status=clean(req.body.status);if(!['approved','needs_action'].includes(status))return fail(res,400,'Trạng thái không hợp lệ');
  const pool=await getPool(),branchScope=await scope(req,pool),request=pool.request().input('id',sql.BigInt,req.params.id).input('status',sql.VarChar(20),status).input('uid',sql.Int,req.user.userId);
  if(branchScope)request.input('branch',sql.Int,branchScope);
  const result=await request.query(`UPDATE branch_operational_reports SET status=@status,reviewed_by=@uid,reviewed_at=SYSDATETIME(),updated_at=SYSDATETIME() OUTPUT INSERTED.id WHERE id=@id${branchScope?' AND branch_id=@branch':''}`);
  if(!result.recordset[0])return fail(res,404,'Không tìm thấy báo cáo');res.json({success:true,message:'Đã cập nhật báo cáo'});
}catch(error){next(error)}}

module.exports={list,create,review};
