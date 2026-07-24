const { sql, getPool } = require("../config/db");
const statuses = ["new","confirmed","preparing","ready","completed","delivered","cancelled"];
const orderTypes = ["dine_in","takeaway","delivery"];
const paymentMethods = ["cash","bank_transfer","momo","zalopay","grab","shopeefood","other"];

async function employeeContext(pool, userId) {
  const result = await pool.request().input("userId", sql.Int, userId).query("SELECT TOP 1 id AS employeeId, branch_id AS branchId FROM employees WHERE user_id=@userId AND status='working'");
  return result.recordset[0];
}

async function getOrders(req, res, next) {
  try {
    const pool = await getPool();
    const request = pool.request();
    let where = "WHERE 1=1";
    if (req.query.status) { if (!statuses.includes(req.query.status)) return res.status(400).json({success:false,message:"Trạng thái không hợp lệ"}); request.input("status",sql.VarChar(30),req.query.status); where += " AND o.status=@status"; }
    if (req.user.role === "employee") {
      const employee = await employeeContext(pool, req.user.userId);
      if (!employee) return res.status(403).json({success:false,message:"Tài khoản chưa liên kết nhân viên"});
      request.input("branchId",sql.Int,employee.branchId); where += " AND o.branch_id=@branchId";
    }
    const result = await request.query(`
      SELECT o.id, o.order_code AS orderCode, o.order_source AS orderSource, o.order_type AS orderType,
             o.customer_name AS customerName, o.customer_phone AS customerPhone,
             o.subtotal, o.discount_amount AS discountAmount, o.total_amount AS totalAmount,
             o.status, o.note, o.created_at AS createdAt, o.completed_at AS completedAt,
             b.branch_name AS branchName, u.full_name AS employeeName,
             COUNT(oi.id) AS itemLines, COALESCE(SUM(oi.quantity),0) AS itemCount
      FROM orders o
      INNER JOIN branches b ON b.id=o.branch_id
      INNER JOIN employees e ON e.id=o.employee_id
      INNER JOIN users u ON u.id=e.user_id
      LEFT JOIN order_items oi ON oi.order_id=o.id
      ${where}
      GROUP BY o.id,o.order_code,o.order_source,o.order_type,o.customer_name,o.customer_phone,o.subtotal,
               o.discount_amount,o.total_amount,o.status,o.note,o.created_at,o.completed_at,b.branch_name,u.full_name
      ORDER BY o.created_at DESC
    `);
    return res.json({success:true,data:result.recordset});
  } catch (error) { return next(error); }
}

async function createOrder(req, res, next) {
  const pool = await getPool();
  const transaction = new sql.Transaction(pool);
  let transactionStarted = false;
  try {
    const { items, orderType="takeaway", paymentMethod="cash", discountAmount=0, customerName=null, customerPhone=null, note=null } = req.body;
    if (!Array.isArray(items) || !items.length) return res.status(400).json({success:false,message:"Đơn hàng phải có ít nhất một sản phẩm"});
    if (!orderTypes.includes(orderType) || !paymentMethods.includes(paymentMethod)) return res.status(400).json({success:false,message:"Loại đơn hoặc phương thức thanh toán không hợp lệ"});
    const employee = await employeeContext(pool, req.user.userId);
    const employeeId = employee?.employeeId || Number(req.body.employeeId);
    const branchId = employee?.branchId || Number(req.body.branchId);
    if (!employeeId || !branchId) return res.status(400).json({success:false,message:"Không xác định được nhân viên hoặc chi nhánh"});

    const ids = [...new Set(items.map(item=>Number(item.productId)).filter(Number.isInteger))];
    if (!ids.length || ids.length !== new Set(items.map(item=>Number(item.productId))).size) return res.status(400).json({success:false,message:"Danh sách sản phẩm không hợp lệ"});
    const productRequest = pool.request();
    ids.forEach((id,index)=>productRequest.input(`p${index}`,sql.Int,id));
    const productResult = await productRequest.query(`SELECT id,product_name,sale_price,status FROM products WHERE id IN (${ids.map((_,i)=>`@p${i}`).join(",")})`);
    const productMap = new Map(productResult.recordset.map(product=>[product.id,product]));
    if (productMap.size !== ids.length || productResult.recordset.some(product=>product.status!=="active")) return res.status(400).json({success:false,message:"Có sản phẩm không tồn tại hoặc ngừng bán"});

    const normalized = items.map(item=>({ product:productMap.get(Number(item.productId)), quantity:Number(item.quantity), discount:Number(item.discountAmount||0), note:item.note||null }));
    if (normalized.some(item=>!Number.isInteger(item.quantity)||item.quantity<1||item.discount<0)) return res.status(400).json({success:false,message:"Số lượng hoặc giảm giá sản phẩm không hợp lệ"});
    const subtotal = normalized.reduce((sum,item)=>sum+Number(item.product.sale_price)*item.quantity,0);
    const discount = Number(discountAmount);
    if (!Number.isFinite(discount)||discount<0||discount>subtotal) return res.status(400).json({success:false,message:"Giảm giá không hợp lệ"});
    const total = subtotal-discount;
    const orderCode=`DG-${Date.now()}-${Math.floor(Math.random()*1000).toString().padStart(3,"0")}`;

    await transaction.begin();
    transactionStarted = true;
    const openShift = await new sql.Request(transaction).input("employeeId",sql.Int,employeeId).query("SELECT TOP 1 id FROM shift_sessions WHERE employee_id=@employeeId AND status='open' ORDER BY opened_at DESC");
    const inserted = await new sql.Request(transaction)
      .input("orderCode",sql.VarChar(50),orderCode).input("branchId",sql.Int,branchId).input("employeeId",sql.Int,employeeId)
      .input("shiftSessionId",sql.Int,openShift.recordset[0]?.id||null).input("orderType",sql.VarChar(30),orderType)
      .input("customerName",sql.NVarChar(150),customerName).input("customerPhone",sql.VarChar(20),customerPhone)
      .input("subtotal",sql.Decimal(18,2),subtotal).input("discount",sql.Decimal(18,2),discount)
      .input("total",sql.Decimal(18,2),total).input("note",sql.NVarChar(500),note)
      .query(`INSERT INTO orders(order_code,branch_id,employee_id,shift_session_id,order_source,order_type,customer_name,customer_phone,subtotal,discount_amount,total_amount,status,note)
              OUTPUT INSERTED.id VALUES(@orderCode,@branchId,@employeeId,@shiftSessionId,'counter',@orderType,@customerName,@customerPhone,@subtotal,@discount,@total,'new',@note)`);
    const orderId=inserted.recordset[0].id;
    for (const item of normalized) {
      await new sql.Request(transaction).input("orderId",sql.BigInt,orderId).input("productId",sql.Int,item.product.id)
        .input("name",sql.NVarChar(200),item.product.product_name).input("quantity",sql.Int,item.quantity)
        .input("price",sql.Decimal(18,2),item.product.sale_price).input("discount",sql.Decimal(18,2),item.discount)
        .input("note",sql.NVarChar(300),item.note)
        .query("INSERT INTO order_items(order_id,product_id,product_name,quantity,unit_price,discount_amount,note) VALUES(@orderId,@productId,@name,@quantity,@price,@discount,@note)");
    }
    if (total>0) await new sql.Request(transaction).input("orderId",sql.BigInt,orderId).input("method",sql.VarChar(30),paymentMethod).input("amount",sql.Decimal(18,2),total).query("INSERT INTO payments(order_id,payment_method,amount,status) VALUES(@orderId,@method,@amount,'completed')");
    await transaction.commit();
    transactionStarted = false;
    return res.status(201).json({success:true,message:"Tạo đơn thành công",data:{id:orderId,orderCode,subtotal,discountAmount:discount,totalAmount:total,status:"new"}});
  } catch (error) { if (transactionStarted) await transaction.rollback().catch(()=>{}); return next(error); }
}

async function updateOrderStatus(req, res, next) {
  try {
    const id=Number(req.params.id),status=req.body.status;
    if (!Number.isInteger(id)||!statuses.includes(status)) return res.status(400).json({success:false,message:"ID hoặc trạng thái không hợp lệ"});
    const pool=await getPool(),current=await pool.request().input("id",sql.BigInt,id).query("SELECT id,status FROM orders WHERE id=@id");
    if (!current.recordset[0]) return res.status(404).json({success:false,message:"Không tìm thấy đơn hàng"});
    if (["completed","delivered","cancelled"].includes(current.recordset[0].status)) return res.status(409).json({success:false,message:"Không thể sửa đơn đã kết thúc"});
    await pool.request().input("id",sql.BigInt,id).input("status",sql.VarChar(30),status).query(`UPDATE orders SET status=@status, completed_at=CASE WHEN @status='completed' THEN SYSDATETIME() ELSE completed_at END, cancelled_at=CASE WHEN @status='cancelled' THEN SYSDATETIME() ELSE cancelled_at END WHERE id=@id`);
    return res.json({success:true,message:"Cập nhật trạng thái thành công",data:{id,status}});
  } catch (error) { return next(error); }
}

module.exports={getOrders,createOrder,updateOrderStatus};
