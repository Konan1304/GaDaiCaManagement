const {sql,getPool}=require("../config/db");
const {employeeFromJwt}=require("../services/shiftEligibilityService");
const {record}=require("../services/shiftEventService");
const DENOMINATIONS=[500000,200000,100000,50000,20000,10000,5000,2000,1000],moneyFields=["cashRevenue","grabRevenue","shopeefoodRevenue","beRevenue","mposRevenue","xanhSmRevenue","actualCash"],countFields=["orderCount"];
const fail=(res,status,message,data)=>res.status(status).json({success:false,message,data}),executor=tx=>({request:()=>new sql.Request(tx)});
const isTestEnv=()=>(process.env.APP_ENV==='sandbox'?1:0);

async function access(ex,userId,id){
  const isTest=isTestEnv();
  const employee=await employeeFromJwt(ex,userId),r=await ex.request().input("id",sql.Int,id).input("isTest",sql.Bit,isTest).query("SELECT TOP 1 id,branch_id branchId,leader_employee_id leaderEmployeeId,business_date businessDate,operation_shift_code operationShift,opening_cash openingCash,status FROM shift_sessions WHERE id=@id AND is_test=@isTest AND operation_shift_code IS NOT NULL");
  const session=r.recordset[0];
  return {employee,session,canView:!!session&&Number(employee?.branchId)===Number(session.branchId),canEdit:!!session&&Number(employee?.employeeId)===Number(session.leaderEmployeeId)}
}

function normalize(body){
  const data={};
  for(const key of moneyFields){const v=Number(body[key]??0);if(!Number.isFinite(v)||v<0)return null;data[key]=Math.round(v*100)/100}
  for(const key of countFields){const v=Number(body[key]??0);if(!Number.isInteger(v)||v<0)return null;data[key]=v}
  Object.assign(data,{grossSales:0,netSales:0,discountAmount:0,otherRevenue:0,cashExpense:0,otherCashIncome:0,customerCount:0});
  data.note=String(body.note||"").trim().slice(0,1000);
  data.version=body.version==null?null:Number(body.version);
  return data;
}

async function totals(ex,id,session,payload){
  const actualCash=payload.actualCash,totalRevenue=payload.cashRevenue+payload.grabRevenue+payload.shopeefoodRevenue+payload.beRevenue+payload.mposRevenue+payload.xanhSmRevenue,expectedCash=Number(session.openingCash);
  return {actualCash,totalRevenue,expectedCash,differenceAmount:actualCash-expectedCash,cashToDeposit:payload.cashRevenue};
}

async function read(ex,id){
  const isTest=isTestEnv();
  const r=await ex.request().input("id",sql.Int,id).input("isTest",sql.Bit,isTest).query(`SELECT TOP 1 id reportId,shift_session_id shiftSessionId,cash_revenue cashRevenue,grab_revenue grabRevenue,shopeefood_revenue shopeefoodRevenue,be_revenue beRevenue,mpos_revenue mposRevenue,xanh_sm_revenue xanhSmRevenue,order_count orderCount,total_revenue totalRevenue,expected_cash expectedCash,actual_cash actualCash,difference_amount differenceAmount,cash_to_deposit cashToDeposit,note,status,submitted_at submittedAt,version,updated_at updatedAt FROM shift_closing_reports WHERE shift_session_id=@id AND is_test=@isTest;SELECT denomination,quantity,subtotal FROM shift_cash_counts WHERE shift_session_id=@id AND is_test=@isTest ORDER BY denomination DESC`);
  const report=r.recordsets[0][0]||null;
  if(report)report.denominations=Object.fromEntries(r.recordsets[1].map(x=>[x.denomination,x.quantity]));
  return report;
}

async function get(req,res,next){try{
  const pool=await getPool(),s=await access(pool,req.user.userId,+req.params.id);
  if(!s.session)return fail(res,404,"Không tìm thấy ca làm");
  if(!s.canView)return fail(res,403,"Bạn không thuộc chi nhánh của ca này");
  res.json({success:true,data:{session:s.session,canEdit:s.canEdit,report:await read(pool,s.session.id),denominations:DENOMINATIONS}})
}catch(e){next(e)}}

async function persist(req,res,next,submit){
  const payload=normalize(req.body);
  if(!payload)return fail(res,400,"Dữ liệu báo cáo không hợp lệ");
  const isTest=isTestEnv(),pool=await getPool(),tx=new sql.Transaction(pool);let begun=false;
  try{
    await tx.begin();begun=true;
    const ex=executor(tx),s=await access(ex,req.user.userId,+req.params.id);
    if(!s.session){await tx.rollback();begun=false;return fail(res,404,"Không tìm thấy ca làm")}
    if(!s.canEdit){await tx.rollback();begun=false;return fail(res,403,"Chỉ người phụ trách ca được lập báo cáo")}
    if(!["OPEN","REOPENED"].includes(s.session.status)){await tx.rollback();begun=false;return fail(res,409,"Ca không ở trạng thái cho phép chỉnh báo cáo")}
    
    const old=await ex.request().input("id",sql.Int,s.session.id).input("isTest",sql.Bit,isTest).query("SELECT TOP 1 * FROM shift_closing_reports WITH(UPDLOCK,HOLDLOCK) WHERE shift_session_id=@id AND is_test=@isTest");
    const existing=old.recordset[0];
    if(existing&&payload.version!=null&&payload.version!==existing.version){await tx.rollback();begun=false;return fail(res,409,"Báo cáo đã được người khác cập nhật",{currentVersion:existing.version})}
    if(submit){
      const image=await ex.request().input("id",sql.Int,s.session.id).input("isTest",sql.Bit,isTest).query("SELECT TOP 1 id FROM operation_attachments WHERE shift_session_id=@id AND attachment_type='pos_screen' AND is_deleted=0 AND is_test=@isTest");
      if(!image.recordset[0]){await tx.rollback();begun=false;return fail(res,400,"Cần ít nhất một ảnh màn hình POS trước khi gửi báo cáo")}
    }
    
    const calc=await totals(ex,s.session.id,s.session,payload);
    if(submit&&calc.differenceAmount!==0&&!payload.note){await tx.rollback();begun=false;return fail(res,400,"Tiền thực tế đang chênh lệch, vui lòng ghi chú để Admin xử lý")};
    const params=ex.request().input("sid",sql.Int,s.session.id).input("eid",sql.Int,s.employee.employeeId).input("uid",sql.Int,req.user.userId).input("date",sql.Date,s.session.businessDate).input("opening",sql.Decimal(18,2),s.session.openingCash).input("gross",sql.Decimal(18,2),payload.grossSales).input("net",sql.Decimal(18,2),payload.netSales).input("orders",sql.Int,payload.orderCount).input("customers",sql.Int,payload.customerCount).input("discount",sql.Decimal(18,2),payload.discountAmount).input("cash",sql.Decimal(18,2),payload.cashRevenue).input("grab",sql.Decimal(18,2),payload.grabRevenue).input("shopee",sql.Decimal(18,2),payload.shopeefoodRevenue).input("be",sql.Decimal(18,2),payload.beRevenue).input("mpos",sql.Decimal(18,2),payload.mposRevenue).input("xanhSm",sql.Decimal(18,2),payload.xanhSmRevenue).input("other",sql.Decimal(18,2),payload.otherRevenue).input("cashExpense",sql.Decimal(18,2),payload.cashExpense).input("cashIncome",sql.Decimal(18,2),payload.otherCashIncome).input("total",sql.Decimal(18,2),calc.totalRevenue).input("expected",sql.Decimal(18,2),calc.expectedCash).input("actual",sql.Decimal(18,2),calc.actualCash).input("diff",sql.Decimal(18,2),calc.differenceAmount).input("deposit",sql.Decimal(18,2),calc.cashToDeposit).input("note",sql.NVarChar(1000),payload.note||null).input("status",sql.VarChar(20),submit?"submitted":"draft").input("isTest",sql.Bit,isTest);
    let reportId;
    if(existing){
      reportId=existing.id;
      await ex.request().input("rid",sql.Int,reportId).input("snapshot",sql.NVarChar(sql.MAX),JSON.stringify(existing)).input("version",sql.Int,existing.version).input("uid",sql.Int,req.user.userId).input("isTest",sql.Bit,isTest).query("IF NOT EXISTS(SELECT 1 FROM shift_report_versions WHERE shift_closing_report_id=@rid AND version=@version) INSERT shift_report_versions(shift_closing_report_id,version,snapshot_json,changed_by,is_test) VALUES(@rid,@version,@snapshot,@uid,@isTest)");
      await params.input("rid",sql.Int,reportId).query(`UPDATE shift_closing_reports SET gross_sales=@gross,net_sales=@net,order_count=@orders,customer_count=@customers,discount_amount=@discount,cash_revenue=@cash,grab_revenue=@grab,shopeefood_revenue=@shopee,be_revenue=@be,mpos_revenue=@mpos,xanh_sm_revenue=@xanhSm,other_revenue=@other,cash_expense=@cashExpense,other_cash_income=@cashIncome,total_revenue=@total,expected_cash=@expected,actual_cash=@actual,difference_amount=@diff,cash_to_deposit=@deposit,note=@note,status=@status,updated_by=@uid,submitted_by=CASE WHEN @status='submitted' THEN @uid ELSE submitted_by END,submitted_at=CASE WHEN @status='submitted' THEN SYSDATETIME() ELSE submitted_at END,updated_at=SYSDATETIME(),version=version+1 WHERE id=@rid`);
    }else{
      const ins=await params.query(`INSERT shift_closing_reports(shift_session_id,employee_id,business_date,opening_cash,gross_sales,net_sales,order_count,customer_count,discount_amount,cash_revenue,grab_revenue,shopeefood_revenue,be_revenue,mpos_revenue,xanh_sm_revenue,other_revenue,cash_expense,other_cash_income,total_revenue,expected_cash,actual_cash,difference_amount,cash_to_deposit,note,status,submitted_by,submitted_at,updated_by,is_test) OUTPUT INSERTED.id VALUES(@sid,@eid,@date,@opening,@gross,@net,@orders,@customers,@discount,@cash,@grab,@shopee,@be,@mpos,@xanhSm,@other,@cashExpense,@cashIncome,@total,@expected,@actual,@diff,@deposit,@note,@status,CASE WHEN @status='submitted' THEN @uid ELSE NULL END,CASE WHEN @status='submitted' THEN SYSDATETIME() ELSE NULL END,@uid,@isTest)`);
      reportId=ins.recordset[0].id;
    }
    await record(ex,{sessionId:s.session.id,branchId:s.session.branchId,userId:req.user.userId,employeeId:s.employee.employeeId,action:submit?"REPORT_SUBMITTED":"REPORT_DRAFT_SAVED",oldStatus:s.session.status,newStatus:submit?"LOCKED":s.session.status,payload:{reportId,...calc}});
    if(submit){
      await ex.request().input("id",sql.Int,s.session.id).query("UPDATE shift_sessions SET status='LOCKED',report_submitted_at=SYSDATETIME(),locked_at=SYSDATETIME(),updated_at=SYSDATETIME() WHERE id=@id");
    }
    await tx.commit();begun=false;
    res.json({success:true,message:submit?"Đã kết ca và gửi báo cáo cho Admin":"Đã lưu bản nháp",data:{reportId,status:submit?"submitted":"draft",...calc}});
  }catch(e){if(begun)await tx.rollback().catch(()=>{});next(e)}
}

module.exports={get,save:(a,b,c)=>persist(a,b,c,false),submit:(a,b,c)=>persist(a,b,c,true),DENOMINATIONS};
