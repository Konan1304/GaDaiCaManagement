const {sql,getPool}=require("../config/db");
const {businessNow}=require("../services/businessClockService");
const isTestEnvironment=()=>process.env.APP_ENV==="sandbox"?1:0;

async function managerBranch(pool,user){
  if(user.role==="admin")return null;
  const result=await pool.request().input("userId",sql.Int,user.userId).query("SELECT TOP 1 branch_id AS branchId FROM employees WHERE user_id=@userId AND status='working'");
  return result.recordset[0]?.branchId||-1;
}

async function getDashboard(req,res,next){try{
  const pool=await getPool(),clock=await businessNow(pool),scope=await managerBranch(pool,req.user);
  if(scope===-1)return res.status(403).json({success:false,message:"Tài khoản quản lý chưa được gán chi nhánh."});
  const requested=Number(req.query.branchId||0),branchId=scope||((Number.isInteger(requested)&&requested>0)?requested:0),isTest=isTestEnvironment();
  const request=pool.request().input("date",sql.Date,clock.businessDate).input("isTest",sql.Bit,isTest);
  if(branchId)request.input("branchId",sql.Int,branchId);
  const branch=(alias)=>branchId?` AND ${alias}.branch_id=@branchId`:"";
  const result=await request.query(`
    SELECT id AS branchId,branch_name AS branchName FROM branches WHERE status='active'${scope?" AND id=@branchId":""} ORDER BY branch_name;

    SELECT
      COALESCE((SELECT SUM(r.total_revenue) FROM shift_closing_reports r JOIN shift_sessions ss ON ss.id=r.shift_session_id WHERE r.business_date=@date AND r.status='submitted' AND r.is_test=@isTest${branch("ss")}),0) AS totalRevenue,
      COALESCE((SELECT SUM(r.order_count) FROM shift_closing_reports r JOIN shift_sessions ss ON ss.id=r.shift_session_id WHERE r.business_date=@date AND r.status='submitted' AND r.is_test=@isTest${branch("ss")}),0) AS orderCount,
      COALESCE((SELECT SUM(r.difference_amount) FROM shift_closing_reports r JOIN shift_sessions ss ON ss.id=r.shift_session_id WHERE r.business_date=@date AND r.status='submitted' AND r.is_test=@isTest${branch("ss")}),0) AS cashDifference,
      (SELECT COUNT(DISTINCT es.employee_id) FROM employee_schedules es WHERE es.work_date=@date AND es.status<>'cancelled' AND es.is_test=@isTest${branch("es")}) AS scheduledEmployees,
      (SELECT COUNT(DISTINCT al.employee_id) FROM attendance_logs al WHERE al.work_date=@date AND al.check_in_time IS NOT NULL AND al.is_test=@isTest${branch("al")}) AS checkedInEmployees,
      (SELECT COUNT(*) FROM branch_inventories bi JOIN products p ON p.id=bi.product_id WHERE p.status='active' AND bi.quantity<=p.minimum_stock${branch("bi")}) AS lowStockCount;

    SELECT ss.operation_shift_code AS operationShift,ss.status,ss.opened_at AS openedAt,ss.report_submitted_at AS submittedAt,ss.opening_cash AS openingCash,u.full_name AS leaderName
    FROM shift_sessions ss LEFT JOIN employees e ON e.id=ss.leader_employee_id LEFT JOIN users u ON u.id=e.user_id
    WHERE ss.business_date=@date AND ss.is_test=@isTest AND ss.operation_shift_code IN('morning','evening') AND ss.status NOT IN('cancelled','CANCELLED')${branch("ss")}
    ORDER BY CASE ss.operation_shift_code WHEN 'morning' THEN 1 ELSE 2 END,ss.id DESC;

    WITH days AS(SELECT DATEADD(day,-6,@date) dayValue UNION ALL SELECT DATEADD(day,1,dayValue) FROM days WHERE dayValue<@date),
    revenue AS(SELECT r.business_date,SUM(r.total_revenue) totalRevenue FROM shift_closing_reports r JOIN shift_sessions ss ON ss.id=r.shift_session_id
      WHERE r.business_date BETWEEN DATEADD(day,-6,@date) AND @date AND r.status='submitted' AND r.is_test=@isTest${branch("ss")} GROUP BY r.business_date)
    SELECT CONVERT(char(10),d.dayValue,23) businessDate,COALESCE(r.totalRevenue,0) totalRevenue FROM days d LEFT JOIN revenue r ON r.business_date=d.dayValue ORDER BY d.dayValue OPTION(MAXRECURSION 7);

    SELECT
      (SELECT COUNT(*) FROM shift_sessions ss WHERE ss.business_date=@date AND ss.is_test=@isTest AND ss.operation_shift_code IN('morning','evening') AND ss.status IN('OPEN','REOPENED')${branch("ss")}) openShiftCount,
      (SELECT COUNT(DISTINCT es.employee_id) FROM employee_schedules es LEFT JOIN attendance_logs al ON al.schedule_id=es.id AND al.employee_id=es.employee_id AND al.is_test=@isTest WHERE es.work_date=@date AND es.status<>'cancelled' AND es.is_test=@isTest AND al.id IS NULL${branch("es")}) notCheckedInCount,
      (SELECT COUNT(*) FROM purchase_receipts pr WHERE pr.status='draft'${branch("pr")}) draftReceiptCount,
      (SELECT COUNT(*) FROM supplier_purchase_orders po WHERE po.status='draft'${branch("po")}) draftPurchaseOrderCount,
      (SELECT COUNT(*) FROM inventory_discrepancies d WHERE d.status='PENDING' AND d.is_test=@isTest${branch("d")}) pendingDiscrepancyCount;

    SELECT TOP 6 ss.id shiftSessionId,CONVERT(char(10),ss.business_date,23) businessDate,ss.operation_shift_code operationShift,ss.status,ss.branch_id branchId,b.branch_name branchName,u.full_name leaderName,r.total_revenue totalRevenue,r.order_count orderCount,r.difference_amount differenceAmount,r.status reportStatus,r.submitted_at submittedAt
    FROM shift_sessions ss JOIN branches b ON b.id=ss.branch_id LEFT JOIN employees e ON e.id=ss.leader_employee_id LEFT JOIN users u ON u.id=e.user_id LEFT JOIN shift_closing_reports r ON r.shift_session_id=ss.id AND r.is_test=@isTest
    WHERE ss.is_test=@isTest AND ss.operation_shift_code IN('morning','evening')${branch("ss")} ORDER BY ss.business_date DESC,ss.id DESC;
  `);
  const summary=result.recordsets[1][0]||{},tasks=result.recordsets[4][0]||{};
  res.json({success:true,data:{businessDate:clock.businessDate,branchId:branchId||null,branches:result.recordsets[0],summary:{totalRevenue:Number(summary.totalRevenue||0),orderCount:Number(summary.orderCount||0),cashDifference:Number(summary.cashDifference||0),scheduledEmployees:Number(summary.scheduledEmployees||0),checkedInEmployees:Number(summary.checkedInEmployees||0),lowStockCount:Number(summary.lowStockCount||0)},shifts:result.recordsets[2],revenueDays:result.recordsets[3].map(x=>({...x,totalRevenue:Number(x.totalRevenue||0)})),tasks:Object.fromEntries(Object.entries(tasks).map(([key,value])=>[key,Number(value||0)])),recentReports:result.recordsets[5]}});
}catch(error){next(error)}}
module.exports={getDashboard};
