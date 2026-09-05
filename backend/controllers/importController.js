const {sql,getPool}=require("../config/db");
const clean=value=>String(value??"").trim();
const fail=(res,status,message)=>res.status(status).json({success:false,message});
const integer=value=>Number.isInteger(Number(value))?Number(value):null;
const decimal=value=>value===""||value===null||value===undefined?null:Number(value);

function normalizeItems(items){
 if(!Array.isArray(items))return [];
 return items.map(item=>({productId:integer(item.productId),quantity:decimal(item.quantity),unitPrice:decimal(item.unitPrice),
  batchNumber:clean(item.batchNumber)||null,manufacturingDate:clean(item.manufacturingDate)||null,
  expiryDate:clean(item.expiryDate)||null,notes:clean(item.notes)||null}));
}
function validate(body,requireItems=false){
 const supplierId=integer(body.supplierId),branchId=integer(body.branchId),items=normalizeItems(body.items);
 if(!supplierId||!branchId)return "Chi nhánh và nhà cung cấp là bắt buộc.";
 if(requireItems&&!items.length)return "Phiếu nhập phải có ít nhất một sản phẩm.";
 const keys=new Set();
 for(const item of items){
  if(!item.productId||!Number.isFinite(item.quantity)||item.quantity<=0)return "Sản phẩm và số lượng nhập phải hợp lệ.";
  if(item.unitPrice!==null&&(!Number.isFinite(item.unitPrice)||item.unitPrice<0))return "Đơn giá không hợp lệ.";
  if(item.manufacturingDate&&item.expiryDate&&item.manufacturingDate>item.expiryDate)return "Ngày sản xuất không được sau hạn sử dụng.";
  const key=`${item.productId}|${(item.batchNumber||"").toLowerCase()}`;
  if(keys.has(key))return "Không được nhập trùng sản phẩm và số lô trong cùng phiếu.";
  keys.add(key);
 }
 return null;
}
async function validateLinks(request,supplierId,branchId,items){
 const productIds=[...new Set(items.map(x=>x.productId))];
 const result=await request.input("supplierId",sql.Int,supplierId).input("branchId",sql.Int,branchId)
  .query(`SELECT (SELECT COUNT(*) FROM suppliers WHERE id=@supplierId AND status='active') supplierOk,
   (SELECT COUNT(*) FROM branches WHERE id=@branchId AND status='active') branchOk`);
 if(!result.recordset[0].supplierOk)throw Object.assign(new Error("Nhà cung cấp đã ngừng hoạt động hoặc không tồn tại."),{status:409});
 if(!result.recordset[0].branchOk)throw Object.assign(new Error("Chi nhánh không hợp lệ."),{status:409});
 if(productIds.length){
  const productResult=await request.query(`SELECT id FROM products WHERE status='active' AND id IN (${productIds.join(",")})`);
  if(productResult.recordset.length!==productIds.length)throw Object.assign(new Error("Có sản phẩm không tồn tại hoặc đã ngừng sử dụng."),{status:409});
 }
}
function bindHeader(request,body){
 return request.input("supplierId",sql.Int,Number(body.supplierId)).input("branchId",sql.Int,Number(body.branchId))
  .input("receiptDate",sql.DateTime2,body.receiptDate?new Date(body.receiptDate):new Date())
  .input("deliveryPerson",sql.NVarChar(150),clean(body.deliveryPerson)||null)
  .input("receivedBy",sql.NVarChar(150),clean(body.receivedBy)||null)
  .input("sourceNumber",sql.NVarChar(100),clean(body.sourceDocumentNumber)||null)
  .input("note",sql.NVarChar(500),clean(body.note||body.notes)||null);
}
async function replaceItems(transaction,receiptId,items){
 await new sql.Request(transaction).input("id",sql.Int,receiptId).query("DELETE purchase_receipt_items WHERE purchase_receipt_id=@id");
 for(const item of items)await new sql.Request(transaction).input("receiptId",sql.Int,receiptId).input("productId",sql.Int,item.productId)
  .input("quantity",sql.Decimal(18,3),item.quantity).input("unitPrice",sql.Decimal(18,2),item.unitPrice)
  .input("batch",sql.NVarChar(100),item.batchNumber).input("mfg",sql.Date,item.manufacturingDate)
  .input("expiry",sql.Date,item.expiryDate).input("notes",sql.NVarChar(500),item.notes)
  .query(`INSERT purchase_receipt_items(purchase_receipt_id,product_id,quantity,unit_price,batch_number,manufacturing_date,expiry_date,notes)
   VALUES(@receiptId,@productId,@quantity,@unitPrice,@batch,@mfg,@expiry,@notes)`);
 await new sql.Request(transaction).input("id",sql.Int,receiptId).query(`UPDATE purchase_receipts SET total_amount=
  COALESCE((SELECT SUM(COALESCE(line_total,0)) FROM purchase_receipt_items WHERE purchase_receipt_id=@id),0),updated_at=SYSDATETIME() WHERE id=@id`);
}

async function list(req,res,next){try{
 const page=Math.max(1,parseInt(req.query.page,10)||1),limit=Math.min(100,Math.max(1,parseInt(req.query.limit,10)||10));
 const request=(await getPool()).request().input("offset",sql.Int,(page-1)*limit).input("limit",sql.Int,limit),where=[];
 const search=clean(req.query.search),status=clean(req.query.status);
 if(search){where.push("(pr.receipt_code LIKE @search OR s.supplier_name LIKE @search OR s.display_name LIKE @search OR pr.source_document_number LIKE @search)");request.input("search",sql.NVarChar(300),`%${search}%`)}
 if(["draft","submitted","returned","rejected","completed","adjusted"].includes(status)){where.push("pr.status=@status");request.input("status",sql.VarChar(20),status)}
 for(const [query,column,param] of [["supplier_id","pr.supplier_id","supplier"],["branch_id","pr.branch_id","branch"]]){const value=integer(req.query[query]);if(value){where.push(`${column}=@${param}`);request.input(param,sql.Int,value)}}
 if(req.query.date_from){where.push("CAST(pr.receipt_date AS date)>=@from");request.input("from",sql.Date,req.query.date_from)}
 if(req.query.date_to){where.push("CAST(pr.receipt_date AS date)<=@to");request.input("to",sql.Date,req.query.date_to)}
 const clause=where.length?`WHERE ${where.join(" AND ")}`:"";
 const result=await request.query(`SELECT pr.id receiptId,pr.receipt_code receiptCode,pr.supplier_id supplierId,COALESCE(s.display_name,s.supplier_name) supplierName,
  pr.branch_id branchId,b.branch_name branchName,pr.receipt_date receiptDate,pr.total_amount totalAmount,pr.status,pr.source_document_number sourceDocumentNumber,
  COUNT(pri.id) itemCount FROM purchase_receipts pr JOIN suppliers s ON s.id=pr.supplier_id JOIN branches b ON b.id=pr.branch_id
  LEFT JOIN purchase_receipt_items pri ON pri.purchase_receipt_id=pr.id ${clause}
  GROUP BY pr.id,pr.receipt_code,pr.supplier_id,s.display_name,s.supplier_name,pr.branch_id,b.branch_name,pr.receipt_date,pr.total_amount,pr.status,pr.source_document_number
  ORDER BY pr.receipt_date DESC,pr.id DESC OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY;
  SELECT COUNT(*) total FROM purchase_receipts pr JOIN suppliers s ON s.id=pr.supplier_id ${clause};`);
 const total=Number(result.recordsets[1][0].total||0);
 res.json({success:true,data:{items:result.recordsets[0],pagination:{page,limit,total,totalPages:Math.max(1,Math.ceil(total/limit))}}});
}catch(error){next(error)}}

async function detail(req,res,next){try{
 const id=integer(req.params.id);if(!id)return fail(res,400,"Phiếu nhập không hợp lệ.");
 const result=await (await getPool()).request().input("id",sql.Int,id).query(`SELECT pr.id receiptId,pr.receipt_code receiptCode,pr.supplier_id supplierId,
  COALESCE(s.display_name,s.supplier_name) supplierName,pr.branch_id branchId,b.branch_name branchName,pr.created_by createdBy,
  u.full_name createdByName,pr.receipt_date receiptDate,pr.total_amount totalAmount,pr.status,pr.note,pr.delivery_person deliveryPerson,
  pr.received_by receivedBy,pr.source_document_number sourceDocumentNumber,pr.created_at createdAt,pr.updated_at updatedAt,pr.confirmed_at confirmedAt
  FROM purchase_receipts pr JOIN suppliers s ON s.id=pr.supplier_id JOIN branches b ON b.id=pr.branch_id JOIN users u ON u.id=pr.created_by WHERE pr.id=@id;
  SELECT pri.id itemId,pri.product_id productId,p.product_code productCode,p.product_name productName,u.unit_name unitName,
  pri.quantity,pri.ordered_quantity orderedQuantity,pri.unit_price unitPrice,pri.line_total lineTotal,pri.batch_number batchNumber,pri.manufacturing_date manufacturingDate,
  pri.expiry_date expiryDate,pri.notes FROM purchase_receipt_items pri JOIN products p ON p.id=pri.product_id
  JOIN units u ON u.id=p.unit_id WHERE pri.purchase_receipt_id=@id ORDER BY pri.id;
  SELECT id,transaction_type transactionType,product_id productId,quantity,unit_cost unitCost,reason,created_at createdAt
  FROM inventory_transactions WHERE reference_type='purchase_receipt' AND reference_id=@id ORDER BY id;
  SELECT id documentId,file_name fileName,mime_type mimeType,file_size fileSize,created_at createdAt FROM purchase_receipt_documents WHERE purchase_receipt_id=@id ORDER BY id;`);
 if(!result.recordsets[0][0])return fail(res,404,"Không tìm thấy phiếu nhập.");
 res.json({success:true,data:{...result.recordsets[0][0],items:result.recordsets[1],transactions:result.recordsets[2],documents:result.recordsets[3]}});
}catch(error){next(error)}}

async function create(req,res,next){let transaction;try{
 const error=validate(req.body,false);if(error)return fail(res,400,error);
 const items=normalizeItems(req.body.items),pool=await getPool();transaction=new sql.Transaction(pool);await transaction.begin();
 await validateLinks(new sql.Request(transaction),Number(req.body.supplierId),Number(req.body.branchId),items);
 const temp=`TMP-${Date.now()}-${Math.random().toString(36).slice(2,7)}`;
 const result=await bindHeader(new sql.Request(transaction),req.body).input("code",sql.VarChar(50),temp).input("userId",sql.Int,req.user.userId)
  .query(`INSERT purchase_receipts(receipt_code,branch_id,supplier_id,created_by,receipt_date,status,note,delivery_person,received_by,source_document_number)
   OUTPUT INSERTED.id VALUES(@code,@branchId,@supplierId,@userId,@receiptDate,'draft',@note,@deliveryPerson,@receivedBy,@sourceNumber)`);
 const id=result.recordset[0].id,code=`PN-${new Date().toISOString().slice(0,10).replaceAll("-","")}-${String(id).padStart(5,"0")}`;
 await new sql.Request(transaction).input("id",sql.Int,id).input("code",sql.VarChar(50),code).query("UPDATE purchase_receipts SET receipt_code=@code WHERE id=@id");
 await replaceItems(transaction,id,items);await transaction.commit();
 res.status(201).json({success:true,message:"Tạo phiếu nhập nháp thành công.",data:{receiptId:id,receiptCode:code}});
}catch(error){if(transaction)try{await transaction.rollback()}catch{};if(error.status)return fail(res,error.status,error.message);next(error)}}

async function update(req,res,next){let transaction;try{
 const id=integer(req.params.id),error=validate(req.body,false);if(!id||error)return fail(res,400,error||"Phiếu nhập không hợp lệ.");
 const items=normalizeItems(req.body.items),pool=await getPool();transaction=new sql.Transaction(pool);await transaction.begin();
 const state=await new sql.Request(transaction).input("id",sql.Int,id).query("SELECT status FROM purchase_receipts WITH (UPDLOCK,HOLDLOCK) WHERE id=@id");
 if(!state.recordset[0])throw Object.assign(new Error("Không tìm thấy phiếu nhập."),{status:404});
 if(state.recordset[0].status!=="draft")throw Object.assign(new Error("Chỉ được sửa phiếu nhập đang ở trạng thái Nháp."),{status:409});
 await validateLinks(new sql.Request(transaction),Number(req.body.supplierId),Number(req.body.branchId),items);
 await bindHeader(new sql.Request(transaction),req.body).input("id",sql.Int,id).query(`UPDATE purchase_receipts SET branch_id=@branchId,supplier_id=@supplierId,
  receipt_date=@receiptDate,note=@note,delivery_person=@deliveryPerson,received_by=@receivedBy,source_document_number=@sourceNumber,updated_at=SYSDATETIME() WHERE id=@id`);
 await replaceItems(transaction,id,items);await transaction.commit();res.json({success:true,message:"Cập nhật phiếu nhập thành công."});
}catch(error){if(transaction)try{await transaction.rollback()}catch{};if(error.status)return fail(res,error.status,error.message);next(error)}}

async function remove(req,res,next){try{
 const id=integer(req.params.id);if(!id)return fail(res,400,"Phiếu nhập không hợp lệ.");
 const result=await (await getPool()).request().input("id",sql.Int,id).query("DELETE purchase_receipts WHERE id=@id AND status='draft'; SELECT @@ROWCOUNT affected");
 if(!result.recordset[0].affected)return fail(res,409,"Chỉ được xóa phiếu nhập đang ở trạng thái Nháp.");
 res.json({success:true,message:"Xóa phiếu nhập nháp thành công."});
}catch(error){next(error)}}

async function confirm(req,res,next){let transaction;try{
 const id=integer(req.params.id);if(!id)return fail(res,400,"Phiếu nhập không hợp lệ.");
 const pool=await getPool();transaction=new sql.Transaction(pool);await transaction.begin();
 const header=await new sql.Request(transaction).input("id",sql.Int,id).query("SELECT * FROM purchase_receipts WITH (UPDLOCK,HOLDLOCK) WHERE id=@id");
 const receipt=header.recordset[0];if(!receipt)throw Object.assign(new Error("Không tìm thấy phiếu nhập."),{status:404});
 if(!["draft","submitted"].includes(receipt.status))throw Object.assign(new Error("Phiếu nhập đã được xử lý hoặc không còn chờ duyệt."),{status:409});
 if(receipt.status==="submitted"){
  const documentCount=(await new sql.Request(transaction).input("id",sql.Int,id).query("SELECT COUNT(*) total FROM purchase_receipt_documents WHERE purchase_receipt_id=@id")).recordset[0].total;
  if(!documentCount)throw Object.assign(new Error("Phiếu do nhân viên gửi phải có ảnh chứng từ trước khi duyệt."),{status:409});
 }
 const rows=(await new sql.Request(transaction).input("id",sql.Int,id).query("SELECT * FROM purchase_receipt_items WHERE purchase_receipt_id=@id")).recordset;
 if(!rows.length)throw Object.assign(new Error("Phiếu nhập phải có ít nhất một sản phẩm."),{status:400});
 for(const item of rows){
  const inventory=(await new sql.Request(transaction).input("branch",sql.Int,receipt.branch_id).input("product",sql.Int,item.product_id)
   .query("SELECT * FROM branch_inventories WITH (UPDLOCK,HOLDLOCK) WHERE branch_id=@branch AND product_id=@product")).recordset[0];
  const oldQty=Number(inventory?.quantity||0),qty=Number(item.quantity),cost=item.unit_price===null?Number(inventory?.average_cost||0):Number(item.unit_price);
  const average=item.unit_price===null?(Number(inventory?.average_cost||0)):((oldQty*Number(inventory?.average_cost||0)+qty*cost)/(oldQty+qty));
  if(inventory)await new sql.Request(transaction).input("id",sql.Int,inventory.id).input("qty",sql.Decimal(18,3),qty).input("avg",sql.Decimal(18,2),average)
   .query("UPDATE branch_inventories SET quantity=quantity+@qty,average_cost=@avg,updated_at=SYSDATETIME() WHERE id=@id");
  else await new sql.Request(transaction).input("branch",sql.Int,receipt.branch_id).input("product",sql.Int,item.product_id).input("qty",sql.Decimal(18,3),qty)
   .input("avg",sql.Decimal(18,2),cost).query("INSERT branch_inventories(branch_id,product_id,quantity,average_cost) VALUES(@branch,@product,@qty,@avg)");
  await new sql.Request(transaction).input("branch",sql.Int,receipt.branch_id).input("product",sql.Int,item.product_id).input("qty",sql.Decimal(18,3),qty)
   .input("cost",sql.Decimal(18,2),cost).input("id",sql.Int,id).input("user",sql.Int,req.user.userId).input("batch",sql.NVarChar(100),item.batch_number)
   .input("mfg",sql.Date,item.manufacturing_date).input("expiry",sql.Date,item.expiry_date)
   .query(`INSERT inventory_transactions(branch_id,product_id,transaction_type,quantity,unit_cost,reference_type,reference_id,created_by,batch_number,manufacturing_date,expiry_date)
    VALUES(@branch,@product,'import',@qty,@cost,'purchase_receipt',@id,@user,@batch,@mfg,@expiry)`);
 }
 await new sql.Request(transaction).input("id",sql.Int,id).input("user",sql.Int,req.user.userId).query("UPDATE purchase_receipts SET status='completed',confirmed_at=SYSDATETIME(),reviewed_at=SYSDATETIME(),reviewed_by=@user,updated_at=SYSDATETIME() WHERE id=@id");
 await transaction.commit();res.json({success:true,message:"Xác nhận nhập kho thành công. Tồn kho đã được cập nhật."});
}catch(error){if(transaction)try{await transaction.rollback()}catch{};if(error.status)return fail(res,error.status,error.message);next(error)}}

async function adjust(req,res,next){let transaction;try{
 const id=integer(req.params.id),productId=integer(req.body.productId),quantity=Number(req.body.quantity),reason=clean(req.body.reason);
 if(!id||!productId||!Number.isFinite(quantity)||quantity===0||!reason)return fail(res,400,"Sản phẩm, số lượng điều chỉnh khác 0 và lý do là bắt buộc.");
 const pool=await getPool();transaction=new sql.Transaction(pool);await transaction.begin();
 const receipt=(await new sql.Request(transaction).input("id",sql.Int,id).query("SELECT * FROM purchase_receipts WITH (UPDLOCK,HOLDLOCK) WHERE id=@id")).recordset[0];
 if(!receipt)throw Object.assign(new Error("Không tìm thấy phiếu nhập."),{status:404});
 if(!["completed","adjusted"].includes(receipt.status))throw Object.assign(new Error("Chỉ được điều chỉnh phiếu đã nhập kho."),{status:409});
 const linked=(await new sql.Request(transaction).input("id",sql.Int,id).input("product",sql.Int,productId).query("SELECT TOP 1 * FROM purchase_receipt_items WHERE purchase_receipt_id=@id AND product_id=@product")).recordset[0];
 if(!linked)throw Object.assign(new Error("Sản phẩm không thuộc phiếu nhập này."),{status:400});
 const inventory=(await new sql.Request(transaction).input("branch",sql.Int,receipt.branch_id).input("product",sql.Int,productId)
  .query("SELECT * FROM branch_inventories WITH (UPDLOCK,HOLDLOCK) WHERE branch_id=@branch AND product_id=@product")).recordset[0];
 if(!inventory||Number(inventory.quantity)+quantity<0)throw Object.assign(new Error("Điều chỉnh làm tồn kho âm nên không thể thực hiện."),{status:409});
 await new sql.Request(transaction).input("id",sql.Int,inventory.id).input("qty",sql.Decimal(18,3),quantity).query("UPDATE branch_inventories SET quantity=quantity+@qty,updated_at=SYSDATETIME() WHERE id=@id");
 await new sql.Request(transaction).input("branch",sql.Int,receipt.branch_id).input("product",sql.Int,productId).input("qty",sql.Decimal(18,3),Math.abs(quantity))
  .input("cost",sql.Decimal(18,2),Number(linked.unit_price||inventory.average_cost||0)).input("id",sql.Int,id).input("reason",sql.NVarChar(500),reason).input("user",sql.Int,req.user.userId)
  .query(`INSERT inventory_transactions(branch_id,product_id,transaction_type,quantity,unit_cost,reference_type,reference_id,reason,created_by)
   VALUES(@branch,@product,CASE WHEN @qty>0 THEN 'adjustment_in' ELSE 'adjustment_out' END,ABS(@qty),@cost,'purchase_receipt',@id,@reason,@user)`);
 await new sql.Request(transaction).input("id",sql.Int,id).query("UPDATE purchase_receipts SET status='adjusted',updated_at=SYSDATETIME() WHERE id=@id");
 await transaction.commit();res.json({success:true,message:"Điều chỉnh tồn kho thành công."});
}catch(error){if(transaction)try{await transaction.rollback()}catch{};if(error.status)return fail(res,error.status,error.message);next(error)}}

async function employeeOptions(req,res,next){try{
 const pool=await getPool();const result=await pool.request().input("user",sql.Int,req.user.userId).query(`SELECT e.branch_id branchId,b.branch_name branchName FROM employees e JOIN users u ON u.id=e.user_id JOIN branches b ON b.id=e.branch_id WHERE e.user_id=@user AND e.status='working' AND u.status='active';
 SELECT id supplierId,COALESCE(display_name,supplier_name) supplierName FROM suppliers WHERE status='active' ORDER BY supplier_name;
 SELECT p.id productId,p.product_code productCode,p.product_name productName,p.description specification,u.unit_name unitName FROM products p JOIN units u ON u.id=p.unit_id WHERE p.status='active' AND p.product_code<>'NVL_KHAC' ORDER BY p.product_name;`);
 if(!result.recordsets[0][0])return fail(res,403,"Không tìm thấy chi nhánh làm việc của nhân viên.");res.json({success:true,data:{branch:result.recordsets[0][0],suppliers:result.recordsets[1],products:result.recordsets[2]}});
}catch(error){next(error)}}

async function employeeCreate(req,res,next){let transaction;try{
 let supplierId=integer(req.body.supplierId);const otherSupplier=req.body.otherSupplier===true,rawItems=Array.isArray(req.body.items)?req.body.items:[],note=clean(req.body.note);
 if(otherSupplier&&!note)return fail(res,400,"Khi chọn nhà cung cấp Khác, ghi chú là bắt buộc.");
 if((!supplierId&&!otherSupplier)||!rawItems.length)return fail(res,400,"Nhà cung cấp và hàng thực nhận là bắt buộc.");
 const items=rawItems.map(item=>({productId:integer(item.productId),otherProduct:item.otherProduct===true,ordered:Number(item.orderedQuantity),note:clean(item.note)||null}));
 if(items.some(item=>(!item.productId&&!item.otherProduct)||!Number.isFinite(item.ordered)||item.ordered<=0))return fail(res,400,"Nguyên liệu và số lượng đặt phải hợp lệ.");
 if(items.some(item=>item.otherProduct&&!item.note))return fail(res,400,"Khi chọn nguyên liệu Khác, tên và quy cách trong ghi chú là bắt buộc.");
 if(items.filter(item=>item.otherProduct).length>1)return fail(res,400,"Mỗi phiếu chỉ được có một dòng nguyên liệu Khác.");
 const pool=await getPool();transaction=new sql.Transaction(pool);await transaction.begin();const employee=(await new sql.Request(transaction).input("user",sql.Int,req.user.userId).query("SELECT e.branch_id branchId FROM employees e JOIN users u ON u.id=e.user_id WHERE e.user_id=@user AND e.status='working' AND u.status='active'")).recordset[0];if(!employee)throw Object.assign(new Error("Không tìm thấy chi nhánh làm việc."),{status:403});
 if(otherSupplier){const other=(await new sql.Request(transaction).query("SELECT TOP 1 id FROM suppliers WHERE supplier_code='NCC_KHAC'; IF @@ROWCOUNT=0 INSERT suppliers(supplier_code,supplier_name,status) OUTPUT INSERTED.id VALUES('NCC_KHAC',N'Nhà cung cấp khác','active');")).recordsets.flat().find(row=>row.id);supplierId=other?.id;if(!supplierId)throw Object.assign(new Error("Không thể xác định nhà cung cấp khác."),{status:500});}
 if(items.some(item=>item.otherProduct)){const result=await new sql.Request(transaction).query(`DECLARE @id INT=(SELECT TOP 1 id FROM products WHERE product_code='NVL_KHAC');
  IF @id IS NULL BEGIN DECLARE @category INT=(SELECT TOP 1 id FROM categories ORDER BY id),@unit INT=(SELECT TOP 1 id FROM units ORDER BY id);
   IF @category IS NULL OR @unit IS NULL THROW 51020,N'Chưa có nhóm hoặc đơn vị tính để tạo nguyên liệu khác.',1;
   INSERT products(category_id,unit_id,product_code,product_name,product_type,sale_price,cost_price,minimum_stock,description,status) OUTPUT INSERTED.id VALUES(@category,@unit,'NVL_KHAC',N'Nguyên liệu khác','ingredient',0,0,0,N'Chi tiết xem trong ghi chú phiếu nhập','active'); END
  ELSE SELECT @id id;`);const otherProductId=result.recordsets.flat().find(row=>row.id)?.id;if(!otherProductId)throw Object.assign(new Error("Không thể xác định nguyên liệu khác."),{status:500});items.forEach(item=>{if(item.otherProduct)item.productId=otherProductId});}
 await validateLinks(new sql.Request(transaction),supplierId,employee.branchId,items);
 const inserted=await new sql.Request(transaction).input("code",sql.VarChar(50),`TMP-${Date.now()}`).input("branch",sql.Int,employee.branchId).input("supplier",sql.Int,supplierId).input("user",sql.Int,req.user.userId).input("date",sql.DateTime2,req.body.receiptDate?new Date(req.body.receiptDate):new Date()).input("delivery",sql.NVarChar(150),clean(req.body.deliveryPerson)||null).input("document",sql.NVarChar(100),clean(req.body.sourceDocumentNumber)||null).input("note",sql.NVarChar(500),note||null).query(`INSERT purchase_receipts(receipt_code,branch_id,supplier_id,created_by,receipt_date,status,note,delivery_person,source_document_number,submitted_at) OUTPUT INSERTED.id VALUES(@code,@branch,@supplier,@user,@date,'submitted',@note,@delivery,@document,SYSDATETIME())`);
 const id=inserted.recordset[0].id,code=`PN-${new Date().toISOString().slice(0,10).replaceAll("-","")}-${String(id).padStart(5,"0")}`;await new sql.Request(transaction).input("id",sql.Int,id).input("code",sql.VarChar(50),code).query("UPDATE purchase_receipts SET receipt_code=@code WHERE id=@id");
 for(const item of items)await new sql.Request(transaction).input("id",sql.Int,id).input("product",sql.Int,item.productId).input("ordered",sql.Decimal(18,3),item.ordered).input("note",sql.NVarChar(500),item.note).query("INSERT purchase_receipt_items(purchase_receipt_id,product_id,ordered_quantity,quantity,notes) VALUES(@id,@product,@ordered,@ordered,@note)");
 await transaction.commit();res.status(201).json({success:true,message:"Đã gửi phiếu nhập hàng chờ Admin duyệt.",data:{receiptId:id,receiptCode:code}});
}catch(error){if(transaction)try{await transaction.rollback()}catch{};if(error.status)return fail(res,error.status,error.message);next(error)}}

async function employeeDocument(req,res,next){try{
 const fs=require("fs"),id=integer(req.params.id);if(!id||!req.file)return fail(res,400,"Thiếu ảnh chứng từ.");const pool=await getPool();const owned=(await pool.request().input("id",sql.Int,id).input("user",sql.Int,req.user.userId).query("SELECT id FROM purchase_receipts WHERE id=@id AND created_by=@user AND status IN('submitted','returned')")).recordset[0];if(!owned){fs.unlink(req.file.path,()=>{});return fail(res,403,"Không có quyền thêm ảnh cho phiếu này.")};await pool.request().input("id",sql.Int,id).input("name",sql.NVarChar(255),req.file.originalname).input("path",sql.NVarChar(1000),req.file.path).input("mime",sql.VarChar(100),req.file.mimetype).input("size",sql.BigInt,req.file.size).input("user",sql.Int,req.user.userId).query("INSERT purchase_receipt_documents(purchase_receipt_id,file_name,file_path,mime_type,file_size,uploaded_by) VALUES(@id,@name,@path,@mime,@size,@user)");res.status(201).json({success:true,message:"Đã lưu ảnh chứng từ."});
}catch(error){next(error)}}

async function documentFile(req,res,next){try{
 const path=require("path"),fs=require("fs"),receiptId=integer(req.params.id),documentId=integer(req.params.documentId);
 if(!receiptId||!documentId)return fail(res,400,"Ảnh chứng từ không hợp lệ.");
 const row=(await (await getPool()).request().input("receipt",sql.Int,receiptId).input("document",sql.Int,documentId).query("SELECT file_name fileName,file_path filePath,mime_type mimeType FROM purchase_receipt_documents WHERE id=@document AND purchase_receipt_id=@receipt")).recordset[0];
 if(!row||!row.filePath||!fs.existsSync(row.filePath))return fail(res,404,"Không tìm thấy ảnh chứng từ.");
 res.type(row.mimeType||"application/octet-stream");
 res.setHeader("Content-Disposition",`inline; filename*=UTF-8''${encodeURIComponent(path.basename(row.fileName||"chung-tu"))}`);
 res.sendFile(path.resolve(row.filePath));
}catch(error){next(error)}}

module.exports={list,detail,create,update,remove,confirm,adjust,employeeOptions,employeeCreate,employeeDocument,documentFile};
