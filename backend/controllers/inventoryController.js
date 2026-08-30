// Luôn dùng cùng instance/driver với pool trong config/db.
// Trộn kiểu dữ liệu từ `mssql` (tedious) với pool `mssql/msnodesqlv8`
// làm node-mssql nhận sai connection và phát sinh `connection.on is not a function`.
const { sql, getPool } = require("../config/db");

const IN_TYPES = "'import','adjustment_in','transfer_in'";
const OUT_TYPES = "'sale','waste','adjustment_out','transfer_out'";

function positiveInt(value, fallback) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}
function validDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || "")) && !Number.isNaN(Date.parse(`${value}T00:00:00`));
}
function getRange(req, res) {
  const end = req.query.dateTo || new Date().toISOString().slice(0, 10);
  const start = req.query.dateFrom || `${end.slice(0, 8)}01`;
  if (!validDate(start) || !validDate(end) || start > end) {
    res.status(400).json({ success: false, message: "Khoảng thời gian không hợp lệ" });
    return null;
  }
  return { start, end };
}
function bindRange(request, branchId, range) {
  return request.input("branchId", sql.Int, branchId).input("dateFrom", sql.Date, range.start).input("dateTo", sql.Date, range.end);
}

const ledgerCte = `WITH movements AS (
 SELECT product_id,
  SUM(CASE WHEN created_at>=@dateFrom AND created_at<DATEADD(day,1,@dateTo) AND transaction_type IN (${IN_TYPES}) THEN quantity ELSE 0 END) period_in,
  SUM(CASE WHEN created_at>=@dateFrom AND created_at<DATEADD(day,1,@dateTo) AND transaction_type IN (${OUT_TYPES}) THEN quantity ELSE 0 END) period_out,
  SUM(CASE WHEN created_at>=DATEADD(day,1,@dateTo) AND transaction_type IN (${IN_TYPES}) THEN quantity WHEN created_at>=DATEADD(day,1,@dateTo) AND transaction_type IN (${OUT_TYPES}) THEN -quantity ELSE 0 END) after_net
 FROM inventory_transactions WHERE branch_id=@branchId GROUP BY product_id
), stock AS (
 SELECT p.id product_id,p.product_code,p.product_name,p.minimum_stock,u.unit_name,
  COALESCE(bi.quantity,0) current_quantity,COALESCE(m.period_in,0) inbound,
  COALESCE(m.period_out,0) outbound,COALESCE(m.after_net,0) after_net
 FROM products p INNER JOIN units u ON u.id=p.unit_id
 LEFT JOIN branch_inventories bi ON bi.product_id=p.id AND bi.branch_id=@branchId
 LEFT JOIN movements m ON m.product_id=p.id
 WHERE p.status<>'inactive' AND (bi.id IS NOT NULL OR m.product_id IS NOT NULL)
), calculated AS (
 SELECT *,current_quantity-after_net closing_quantity,
  current_quantity-after_net-inbound+outbound opening_quantity FROM stock
)`;

async function list(req, res, next) {
  try {
    const range = getRange(req, res); if (!range) return;
    const pool = await getPool();
    const branches = (await pool.request().query("SELECT id,branch_code branchCode,branch_name branchName FROM branches WHERE status='active' ORDER BY branch_name")).recordset
      .map(branch => ({ ...branch, id: Number(branch.id) }));
    if (!branches.length) return res.json({ success:true, data:{ branches:[],items:[],summary:{},pagination:{page:1,total:0,totalPages:1} } });
    const branchId = positiveInt(req.query.branchId, branches[0].id);
    if (!branches.some(x=>x.id===branchId)) return res.status(404).json({ success:false,message:"Không tìm thấy chi nhánh" });
    const page=positiveInt(req.query.page,1),limit=Math.min(positiveInt(req.query.limit,20),100);
    const search=String(req.query.search||"").trim();
    const request=bindRange(pool.request(),branchId,range).input("search",sql.NVarChar(200),`%${search}%`).input("offset",sql.Int,(page-1)*limit).input("limit",sql.Int,limit);
    const result=await request.query(`${ledgerCte}
 SELECT COUNT(*) OVER() totalRows,product_id productId,product_code productCode,product_name productName,
  unit_name unitName,minimum_stock minimumStock,opening_quantity openingQuantity,inbound,outbound,closing_quantity closingQuantity,
  CASE WHEN closing_quantity<=0 THEN 'out_of_stock' WHEN closing_quantity<=minimum_stock THEN 'low_stock' ELSE 'in_stock' END stockStatus
 FROM calculated WHERE @search='%%' OR product_name LIKE @search OR product_code LIKE @search
 ORDER BY product_name OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY;
 ${ledgerCte}
 SELECT COUNT(*) totalProducts,COALESCE(SUM(opening_quantity),0) totalOpening,COALESCE(SUM(inbound),0) totalInbound,
  COALESCE(SUM(outbound),0) totalOutbound,COALESCE(SUM(closing_quantity),0) totalClosing
 FROM calculated WHERE @search='%%' OR product_name LIKE @search OR product_code LIKE @search;`);
    const items=result.recordsets[0],total=Number(items[0]?.totalRows||0); items.forEach(x=>delete x.totalRows);
    return res.json({success:true,data:{branches,selectedBranchId:branchId,period:range,summary:result.recordsets[1][0],items,pagination:{page,limit,total,totalPages:Math.max(1,Math.ceil(total/limit))}}});
  } catch(error) { return next(error); }
}

async function detail(req,res,next) {
  try {
    const range=getRange(req,res); if(!range)return;
    const productId=positiveInt(req.params.productId,null),branchId=positiveInt(req.query.branchId,null);
    if(!productId||!branchId)return res.status(400).json({success:false,message:"Sản phẩm hoặc chi nhánh không hợp lệ"});
    const pool=await getPool();
    const branch=(await pool.request().input("id",sql.Int,branchId).query("SELECT id,branch_name branchName FROM branches WHERE id=@id")).recordset[0];
    if(!branch)return res.status(404).json({success:false,message:"Không tìm thấy chi nhánh"});
    const result=await bindRange(pool.request(),branchId,range).input("productId",sql.Int,productId).query(`${ledgerCte}
 SELECT product_id productId,product_code productCode,product_name productName,unit_name unitName,minimum_stock minimumStock,
  opening_quantity openingQuantity,inbound,outbound,closing_quantity closingQuantity FROM calculated WHERE product_id=@productId;
 SELECT it.id,it.created_at transactionTime,it.transaction_type transactionType,it.quantity,it.reason,
  it.reference_type referenceType,it.reference_id referenceId,COALESCE(u.full_name,N'Hệ thống') performedBy
 FROM inventory_transactions it LEFT JOIN users u ON u.id=it.created_by
 WHERE it.branch_id=@branchId AND it.product_id=@productId AND it.created_at>=@dateFrom AND it.created_at<DATEADD(day,1,@dateTo)
 ORDER BY it.created_at DESC,it.id DESC;`);
    if(!result.recordsets[0][0])return res.status(404).json({success:false,message:"Không tìm thấy sản phẩm trong kho chi nhánh"});
    return res.json({success:true,data:{branch,period:range,summary:result.recordsets[0][0],transactions:result.recordsets[1]}});
  } catch(error) { return next(error); }
}

async function transactions(req,res,next) {
  try {
    const range=getRange(req,res); if(!range)return;
    const branchId=positiveInt(req.query.branchId,null);
    if(!branchId)return res.status(400).json({success:false,message:"Chi nhánh không hợp lệ"});
    const page=positiveInt(req.query.page,1),limit=Math.min(positiveInt(req.query.limit,30),100);
    const search=String(req.query.search||"").trim();
    const pool=await getPool();
    const exists=(await pool.request().input("id",sql.Int,branchId).query("SELECT id FROM branches WHERE id=@id AND status='active'")).recordset[0];
    if(!exists)return res.status(404).json({success:false,message:"Không tìm thấy chi nhánh"});
    const result=await bindRange(pool.request(),branchId,range)
      .input("search",sql.NVarChar(200),`%${search}%`).input("offset",sql.Int,(page-1)*limit).input("limit",sql.Int,limit)
      .query(`SELECT COUNT(*) OVER() totalRows,it.id,it.created_at transactionTime,p.product_code productCode,
       p.product_name productName,it.transaction_type transactionType,it.quantity,u.unit_name unitName,
       b.branch_name branchName,COALESCE(usr.full_name,N'Hệ thống') performedBy,it.reference_type referenceType,
       it.reference_id referenceId,it.reason
       FROM inventory_transactions it
       JOIN products p ON p.id=it.product_id JOIN units u ON u.id=p.unit_id JOIN branches b ON b.id=it.branch_id
       LEFT JOIN users usr ON usr.id=it.created_by
       WHERE it.branch_id=@branchId AND it.created_at>=@dateFrom AND it.created_at<DATEADD(day,1,@dateTo)
       AND (@search='%%' OR p.product_name LIKE @search OR p.product_code LIKE @search)
       ORDER BY it.created_at DESC,it.id DESC OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY`);
    const items=result.recordset,total=Number(items[0]?.totalRows||0);items.forEach(x=>delete x.totalRows);
    return res.json({success:true,data:{items,pagination:{page,limit,total,totalPages:Math.max(1,Math.ceil(total/limit))}}});
  } catch(error){return next(error)}
}

async function createExport(req,res,next) {
  const branchId=positiveInt(req.body.branchId,null),productId=positiveInt(req.body.productId,null);
  const quantity=Number(req.body.quantity),reason=String(req.body.reason||"").trim();
  if(!branchId||!productId||!Number.isFinite(quantity)||quantity<=0)return res.status(400).json({success:false,message:"Thông tin xuất kho không hợp lệ"});
  const pool=await getPool(),tx=new sql.Transaction(pool);let started=false;
  try {
    await tx.begin();started=true;
    const row=(await new sql.Request(tx).input("branchId",sql.Int,branchId).input("productId",sql.Int,productId)
      .query(`SELECT bi.id,bi.quantity,p.status productStatus,b.status branchStatus
       FROM branch_inventories bi WITH(UPDLOCK,HOLDLOCK) JOIN products p ON p.id=bi.product_id JOIN branches b ON b.id=bi.branch_id
       WHERE bi.branch_id=@branchId AND bi.product_id=@productId`)).recordset[0];
    if(!row||row.productStatus==='inactive'||row.branchStatus!=='active'){await tx.rollback();started=false;return res.status(404).json({success:false,message:"Không tìm thấy sản phẩm trong kho chi nhánh"})}
    if(Number(row.quantity)<quantity){await tx.rollback();started=false;return res.status(409).json({success:false,message:"Số lượng xuất vượt quá tồn kho hiện tại"})}
    await new sql.Request(tx).input("id",sql.Int,row.id).input("quantity",sql.Decimal(18,3),quantity)
      .query("UPDATE branch_inventories SET quantity=quantity-@quantity,updated_at=SYSDATETIME() WHERE id=@id");
    const inserted=await new sql.Request(tx).input("branchId",sql.Int,branchId).input("productId",sql.Int,productId)
      .input("quantity",sql.Decimal(18,3),quantity).input("reason",sql.NVarChar(500),reason||null).input("userId",sql.Int,req.user.userId)
      .query(`INSERT inventory_transactions(branch_id,product_id,transaction_type,quantity,reference_type,reason,created_by)
       OUTPUT INSERTED.id VALUES(@branchId,@productId,'transfer_out',@quantity,'stock_export',@reason,@userId)`);
    await tx.commit();started=false;
    return res.status(201).json({success:true,message:"Xuất kho thành công",data:{transactionId:inserted.recordset[0].id}});
  } catch(error){if(started)await tx.rollback().catch(()=>{});return next(error)}
}
module.exports={list,detail,transactions,createExport};
