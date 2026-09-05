const path=require("path"),fs=require("fs");const {sql,getPool}=require("../config/db"),{employeeFromJwt}=require("../services/shiftEligibilityService"),{record}=require("../services/shiftEventService"),upload=require("../middleware/operationUpload");
const DENOMS=[1000,2000,5000,10000,20000,50000,100000,200000,500000],fail=(r,s,m)=>r.status(s).json({success:false,message:m}),executor=t=>({request:()=>new sql.Request(t)});
const isTestEnv=()=>(process.env.APP_ENV==='sandbox'?1:0);

async function state(ex,userId,id){
  const isTest=isTestEnv();
  const employee=await employeeFromJwt(ex,userId),r=await ex.request().input("id",sql.Int,id).input("isTest",sql.Bit,isTest).query("SELECT TOP 1 id,branch_id branchId,leader_employee_id leaderEmployeeId,business_date businessDate,operation_shift_code operationShift,opening_cash openingCash,status FROM shift_sessions WHERE id=@id AND is_test=@isTest");
  const session=r.recordset[0];
  return {employee,session,view:session&&Number(employee?.branchId)===Number(session.branchId),edit:session&&Number(employee?.employeeId)===Number(session.leaderEmployeeId)}
}

async function cashGet(req,res,next){try{
  const isTest=isTestEnv(),p=await getPool(),s=await state(p,req.user.userId,+req.params.id);
  if(!s.view)return fail(res,s.session?403:404,"Không có quyền xem kiểm kê");
  const r=await p.request().input("id",sql.Int,s.session.id).input("isTest",sql.Bit,isTest).query("SELECT denomination,quantity,subtotal FROM shift_cash_counts WHERE shift_session_id=@id AND is_test=@isTest ORDER BY denomination DESC");
  res.json({success:true,data:{items:r.recordset,total:r.recordset.reduce((a,x)=>a+Number(x.subtotal),0),denominations:DENOMS,canEdit:s.edit&&['OPEN','REOPENED'].includes(s.session.status)}})
}catch(e){next(e)}}

async function cashPut(req,res,next){
  const isTest=isTestEnv(),p=await getPool(),tx=new sql.Transaction(p);let begun=false;
  try{
    const raw=req.body.denominations||{},keys=Object.keys(raw).map(Number);
    if(keys.some(x=>!DENOMS.includes(x))||DENOMS.some(x=>{const q=Number(raw[x]??0);return !Number.isInteger(q)||q<0}))return fail(res,400,"Mệnh giá hoặc số lượng không hợp lệ");
    await tx.begin();begun=true;const ex=executor(tx),s=await state(ex,req.user.userId,+req.params.id);
    if(!s.edit){await tx.rollback();begun=false;return fail(res,403,"Chỉ người phụ trách ca được kiểm kê")}
    if(!['OPEN','REOPENED'].includes(s.session.status)){await tx.rollback();begun=false;return fail(res,409,"Ca đã khóa chỉnh sửa")};
    for(const d of DENOMS)await ex.request().input("sid",sql.Int,s.session.id).input("d",sql.Int,d).input("q",sql.Int,Number(raw[d]??0)).input("uid",sql.Int,req.user.userId).input("isTest",sql.Bit,isTest).query("MERGE shift_cash_counts t USING(SELECT @sid sid,@d d)s ON t.shift_session_id=s.sid AND t.denomination=s.d WHEN MATCHED THEN UPDATE SET quantity=@q,counted_by=@uid,updated_at=SYSDATETIME() WHEN NOT MATCHED THEN INSERT(shift_session_id,denomination,quantity,counted_by,is_test) VALUES(@sid,@d,@q,@uid,@isTest);");
    await tx.commit();begun=false;res.json({success:true,message:"Đã lưu kiểm kê tiền"})
  }catch(e){if(begun)await tx.rollback().catch(()=>{});next(e)}
}

async function attachments(req,res,next){try{
  const isTest=isTestEnv(),p=await getPool(),s=await state(p,req.user.userId,+req.params.id);
  if(!s.view&&req.user.role!=="admin")return fail(res,s.session?403:404,"Không có quyền xem ảnh");
  const r=await p.request().input("id",sql.Int,s.session.id).input("isTest",sql.Bit,isTest).query("SELECT id attachmentId,attachment_type attachmentType,original_name originalName,mime_type mimeType,file_size fileSize,created_at createdAt FROM operation_attachments WHERE shift_session_id=@id AND is_deleted=0 AND is_test=@isTest ORDER BY id DESC");
  res.json({success:true,data:r.recordset})
}catch(e){next(e)}}

async function addAttachment(req,res,next){try{
  const isTest=isTestEnv(),p=await getPool(),s=await state(p,req.user.userId,+req.params.id);
  if(!s.edit){if(req.file)fs.unlink(req.file.path,()=>{});return fail(res,403,"Chỉ người phụ trách ca được thêm ảnh")}
  const type=String(req.body.attachmentType||"other");
  if(!['pos_screen','cash_count','cash','handover','confirmation','incident','other'].includes(type)){fs.unlink(req.file.path,()=>{});return fail(res,400,"Loại ảnh không hợp lệ")}
  const count=await p.request().input("id",sql.Int,s.session.id).input("isTest",sql.Bit,isTest).query("SELECT COUNT(*) n FROM operation_attachments WHERE shift_session_id=@id AND is_deleted=0 AND is_test=@isTest");
  if(Number(count.recordset[0].n)>=10){fs.unlink(req.file.path,()=>{});return fail(res,400,"Mỗi báo cáo tối đa 10 ảnh")}
  const r=await p.request().input("sid",sql.Int,s.session.id).input("type",sql.VarChar(20),type).input("original",sql.NVarChar(255),req.file.originalname).input("stored",sql.VarChar(100),req.file.filename).input("mime",sql.VarChar(50),req.file.mimetype).input("size",sql.Int,req.file.size).input("relative",sql.NVarChar(500),req.file.filename).input("uid",sql.Int,req.user.userId).input("isTest",sql.Bit,isTest).query("INSERT operation_attachments(shift_session_id,attachment_type,original_name,stored_name,mime_type,file_size,relative_path,uploaded_by,is_test) OUTPUT INSERTED.id attachmentId VALUES(@sid,@type,@original,@stored,@mime,@size,@relative,@uid,@isTest)");
  res.status(201).json({success:true,message:"Đã tải ảnh",data:r.recordset[0]})
}catch(e){if(req.file)fs.unlink(req.file.path,()=>{});next(e)}}

async function file(req,res,next){try{
  const isTest=isTestEnv(),p=await getPool(),employee=await employeeFromJwt(p,req.user.userId),r=await p.request().input("id",sql.BigInt,req.params.attachmentId).input("isTest",sql.Bit,isTest).query("SELECT a.relative_path relativePath,a.mime_type mimeType,ss.branch_id branchId FROM operation_attachments a JOIN shift_sessions ss ON ss.id=a.shift_session_id WHERE a.id=@id AND a.is_deleted=0 AND a.is_test=@isTest");
  const x=r.recordset[0];if(!x)return fail(res,404,"Không tìm thấy ảnh");
  if(req.user.role!=="admin"&&Number(employee?.branchId)!==Number(x.branchId))return fail(res,403,"Không có quyền xem ảnh");
  res.type(x.mimeType).sendFile(path.resolve(upload.root,x.relativePath))
}catch(e){next(e)}}

async function removeAttachment(req,res,next){try{
  const isTest=isTestEnv(),p=await getPool(),s=await state(p,req.user.userId,+req.params.id);
  if(!s.edit)return fail(res,403,"Không có quyền xóa ảnh");
  const r=await p.request().input("id",sql.BigInt,req.params.attachmentId).input("sid",sql.Int,s.session.id).input("uid",sql.Int,req.user.userId).input("isTest",sql.Bit,isTest).query("UPDATE operation_attachments SET is_deleted=1,deleted_by=@uid,deleted_at=SYSDATETIME() WHERE id=@id AND shift_session_id=@sid AND is_deleted=0 AND is_test=@isTest;SELECT @@ROWCOUNT n");
  if(!Number(r.recordset[0].n))return fail(res,404,"Không tìm thấy ảnh");
  res.json({success:true,message:"Đã xóa ảnh"})
}catch(e){next(e)}}

async function handoverGet(req,res,next){try{
  const isTest=isTestEnv(),p=await getPool(),s=await state(p,req.user.userId,+req.params.id);
  if(!s.view)return fail(res,s.session?403:404,"Không có quyền xem bàn giao");
  const r=await p.request().input("id",sql.Int,s.session.id).input("eid",sql.Int,s.employee.employeeId).input("isTest",sql.Bit,isTest).query(`
    SELECT TOP 1 id handoverId,from_shift_session_id fromShiftSessionId,to_shift_session_id toShiftSessionId,to_branch_id toBranchId,CONVERT(char(10),to_business_date,23) toBusinessDate,to_operation_shift_code toOperationShift,expected_opening_cash expectedOpeningCash,actual_received_cash actualReceivedCash,difference_amount differenceAmount,handover_note handoverNote,receiver_note receiverNote,status,sent_at sentAt,received_at receivedAt FROM shift_handovers WHERE from_shift_session_id=@id AND is_test=@isTest;
    SELECT TOP 1 a.id FROM shift_handovers h JOIN operation_shift_assignments a ON a.branch_id=h.to_branch_id AND a.business_date=h.to_business_date AND a.operation_shift_code=h.to_operation_shift_code AND a.status='assigned' AND a.is_test=@isTest WHERE h.from_shift_session_id=@id AND h.is_test=@isTest AND a.employee_id=@eid;
    SELECT TOP 1 al.id FROM shift_handovers h JOIN employee_schedules es ON es.employee_id=@eid AND es.branch_id=h.to_branch_id AND es.work_date=h.to_business_date AND (es.is_test=@isTest OR (es.is_test=0 AND @isTest=1)) JOIN operation_shift_mappings m ON m.branch_id=es.branch_id AND m.shift_id=es.shift_id AND m.operation_shift_code=h.to_operation_shift_code AND m.is_active=1 JOIN attendance_logs al ON al.schedule_id=es.id AND al.employee_id=@eid AND al.check_in_time IS NOT NULL AND (al.is_test=@isTest OR (al.is_test=0 AND @isTest=1)) WHERE h.from_shift_session_id=@id AND h.is_test=@isTest`);
  const item=r.recordsets[0][0]||null;
  if(item){
    item.isSender=Number(s.employee.employeeId)===Number(s.session.leaderEmployeeId);
    item.canReceive=!item.isSender&&!!r.recordsets[2][0]&&item.status==='PENDING'
  }
  res.json({success:true,data:item})
}catch(e){next(e)}}

async function receiveByCheckedInAccount(req,res,next){
  const isTest=isTestEnv(),p=await getPool(),tx=new sql.Transaction(p);let begun=false;
  try{
    const actual=Number(req.body.actualReceivedCash),status=String(req.body.status||"ACCEPTED"),note=String(req.body.receiverNote||"").trim();
    if(!Number.isFinite(actual)||actual<0||!["ACCEPTED","DISPUTED"].includes(status))return fail(res,400,"Dữ liệu nhận bàn giao không hợp lệ");
    await tx.begin();begun=true;const ex=executor(tx),employee=await employeeFromJwt(ex,req.user.userId);
    const result=await ex.request().input("id",sql.Int,req.params.id).input("isTest",sql.Bit,isTest).query("SELECT TOP 1 h.*,ss.branch_id branchId,ss.leader_employee_id senderEmployeeId FROM shift_handovers h JOIN shift_sessions ss ON ss.id=h.from_shift_session_id WHERE h.from_shift_session_id=@id AND h.status='PENDING' AND h.is_test=@isTest");
    const h=result.recordset[0];
    if(!h){await tx.rollback();begun=false;return fail(res,409,"Bàn giao không tồn tại hoặc đã được xử lý")}
    if(Number(h.senderEmployeeId)===Number(employee?.employeeId)){await tx.rollback();begun=false;return fail(res,403,"Người gửi không được tự nhận bàn giao")}
    const eligible=await ex.request().input("eid",sql.Int,employee?.employeeId||0).input("branch",sql.Int,h.to_branch_id).input("date",sql.Date,h.to_business_date).input("op",sql.VarChar(10),h.to_operation_shift_code).input("isTest",sql.Bit,isTest).query(`SELECT TOP 1 al.id FROM attendance_logs al JOIN employee_schedules es ON es.id=al.schedule_id AND es.employee_id=@eid AND es.branch_id=@branch AND es.work_date=@date AND (es.is_test=@isTest OR (es.is_test=0 AND @isTest=1)) JOIN operation_shift_mappings m ON m.branch_id=es.branch_id AND m.shift_id=es.shift_id AND m.operation_shift_code=@op AND m.is_active=1 WHERE al.employee_id=@eid AND al.schedule_id=es.id AND al.check_in_time IS NOT NULL AND (al.is_test=@isTest OR (al.is_test=0 AND @isTest=1))`);
    if(!eligible.recordset[0]){await tx.rollback();begun=false;return fail(res,403,"Tài khoản nhận phải có lịch đúng ca và đã chấm công vào")}
    const diff=actual-Number(h.expected_opening_cash);
    if(diff!==0&&status!=="DISPUTED"){await tx.rollback();begun=false;return fail(res,400,"Tiền bàn giao chênh lệch, phải chọn tranh chấp")}
    if(status==="DISPUTED"&&!note){await tx.rollback();begun=false;return fail(res,400,"Tranh chấp bắt buộc nhập lý do")}
    if(status==="DISPUTED"){
      const img=await ex.request().input("sid",sql.Int,h.from_shift_session_id).input("isTest",sql.Bit,isTest).query("SELECT TOP 1 id FROM operation_attachments WHERE shift_session_id=@sid AND attachment_type IN('handover','confirmation') AND is_deleted=0 AND is_test=@isTest");
      if(!img.recordset[0]){await tx.rollback();begun=false;return fail(res,400,"Tranh chấp cần ảnh chứng minh")}
    }
    await ex.request().input("hid",sql.BigInt,h.id).input("eid",sql.Int,employee.employeeId).input("actual",sql.Decimal(18,2),actual).input("diff",sql.Decimal(18,2),diff).input("note",sql.NVarChar(1000),note||null).input("status",sql.VarChar(12),status).query("UPDATE shift_handovers SET received_by_employee_id=@eid,receiver_assignment_id=NULL,actual_received_cash=@actual,difference_amount=@diff,receiver_note=@note,status=@status,received_at=SYSDATETIME(),updated_at=SYSDATETIME() WHERE id=@hid");
    await ex.request().input("id",sql.Int,h.from_shift_session_id).query("UPDATE shift_sessions SET status='LOCKED',handed_over_at=SYSDATETIME(),locked_at=SYSDATETIME(),updated_at=SYSDATETIME() WHERE id=@id");
    await record(ex,{sessionId:h.from_shift_session_id,branchId:h.branchId,userId:req.user.userId,employeeId:employee.employeeId,action:status==="DISPUTED"?"HANDOVER_DISPUTED":"HANDOVER_ACCEPTED",oldStatus:"WAITING_HANDOVER",newStatus:"LOCKED",payload:{handoverId:h.id,actual,diff,status}});
    await tx.commit();begun=false;res.json({success:true,message:status==="DISPUTED"?"Đã ghi nhận bàn giao tranh chấp":"Đã nhận bàn giao và khóa ca"});
  }catch(e){if(begun)await tx.rollback().catch(()=>{});next(e)}
}

async function history(req,res,next){try{
  const isTest=isTestEnv(),p=await getPool(),employee=await employeeFromJwt(p,req.user.userId),r=await p.request().input("branch",sql.Int,employee.branchId).input("isTest",sql.Bit,isTest).query("SELECT ss.id shiftSessionId,ss.business_date businessDate,ss.operation_shift_code operationShift,ss.status,r.net_sales netSales,r.total_revenue totalRevenue,r.difference_amount differenceAmount,r.submitted_at submittedAt FROM shift_sessions ss LEFT JOIN shift_closing_reports r ON r.shift_session_id=ss.id AND r.is_test=@isTest WHERE ss.branch_id=@branch AND ss.is_test=@isTest ORDER BY ss.business_date DESC,ss.operation_shift_code");
  res.json({success:true,data:r.recordset})
}catch(e){next(e)}}

module.exports={cashGet,cashPut,attachments,addAttachment,file,removeAttachment,handoverGet,receive:receiveByCheckedInAccount,history};
