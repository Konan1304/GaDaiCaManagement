const fs=require("fs");
const ExcelJS=require("exceljs");
const PDFDocument=require("pdfkit");
const {sql,getPool}=require("../config/db");
const fail=(res,status,message)=>res.status(status).json({success:false,message});
const integer=value=>Number.isInteger(Number(value))?Number(value):null;
const clean=value=>String(value??"").trim();
const itemsOf=body=>Array.isArray(body.items)?body.items.map(item=>({productId:integer(item.productId),quantity:Number(item.quantity)})):[];

function validate(body){
  const supplierId=integer(body.supplierId),branchId=integer(body.branchId),items=itemsOf(body);
  if(!supplierId||!branchId)return "Nhà cung cấp và chi nhánh là bắt buộc.";
  if(!items.length)return "Phiếu đặt hàng phải có ít nhất một nguyên liệu.";
  const ids=new Set();
  for(const item of items){if(!item.productId||!Number.isFinite(item.quantity)||item.quantity<=0)return "Nguyên liệu và số lượng đặt không hợp lệ.";if(ids.has(item.productId))return "Không được chọn trùng nguyên liệu.";ids.add(item.productId)}
  return null;
}
async function ensureLinks(request,body){
  const ids=itemsOf(body).map(item=>item.productId);
  const result=await request.input("supplier",sql.Int,Number(body.supplierId)).input("branch",sql.Int,Number(body.branchId)).query(`SELECT
    (SELECT COUNT(*) FROM suppliers WHERE id=@supplier AND status='active') supplierOk,
    (SELECT COUNT(*) FROM branches WHERE id=@branch AND status='active') branchOk,
    (SELECT COUNT(*) FROM products WHERE id IN (${ids.join(",")}) AND status='active') productCount`);
  const row=result.recordset[0];
  if(!row.supplierOk)throw Object.assign(new Error("Nhà cung cấp không tồn tại hoặc đã ngừng hoạt động."),{status:409});
  if(!row.branchOk)throw Object.assign(new Error("Chi nhánh không hợp lệ."),{status:409});
  if(Number(row.productCount)!==new Set(ids).size)throw Object.assign(new Error("Có nguyên liệu không tồn tại hoặc đã ngừng sử dụng."),{status:409});
}
async function replaceItems(transaction,id,items){
  await new sql.Request(transaction).input("id",sql.Int,id).query("DELETE supplier_purchase_order_items WHERE purchase_order_id=@id");
  for(const item of items)await new sql.Request(transaction).input("id",sql.Int,id).input("product",sql.Int,item.productId).input("quantity",sql.Decimal(18,3),item.quantity).query("INSERT supplier_purchase_order_items(purchase_order_id,product_id,quantity) VALUES(@id,@product,@quantity)");
}
async function orderData(id){
  return (await (await getPool()).request().input("id",sql.Int,id).query(`SELECT po.id orderId,po.order_code orderCode,po.supplier_id supplierId,COALESCE(s.display_name,s.supplier_name) supplierName,
    po.branch_id branchId,b.branch_name branchName,po.order_date orderDate,po.note,po.status,po.created_at createdAt,u.full_name createdByName
    FROM supplier_purchase_orders po JOIN suppliers s ON s.id=po.supplier_id JOIN branches b ON b.id=po.branch_id JOIN users u ON u.id=po.created_by WHERE po.id=@id;
    SELECT poi.id itemId,poi.product_id productId,p.category_id categoryId,c.category_name categoryName,p.product_code productCode,p.product_name productName,p.description specification,un.unit_name unitName,poi.quantity
    FROM supplier_purchase_order_items poi JOIN products p ON p.id=poi.product_id JOIN categories c ON c.id=p.category_id JOIN units un ON un.id=p.unit_id WHERE poi.purchase_order_id=@id ORDER BY poi.id;`)).recordsets;
}
async function list(req,res,next){try{
  const result=await (await getPool()).request().query(`SELECT TOP 100 po.id orderId,po.order_code orderCode,po.order_date orderDate,po.status,po.note,
    COALESCE(s.display_name,s.supplier_name) supplierName,b.branch_name branchName,COUNT(i.id) itemCount
    FROM supplier_purchase_orders po JOIN suppliers s ON s.id=po.supplier_id JOIN branches b ON b.id=po.branch_id
    LEFT JOIN supplier_purchase_order_items i ON i.purchase_order_id=po.id
    GROUP BY po.id,po.order_code,po.order_date,po.status,po.note,s.display_name,s.supplier_name,b.branch_name ORDER BY po.order_date DESC,po.id DESC`);
  res.json({success:true,data:result.recordset});
}catch(error){next(error)}}
async function detail(req,res,next){try{const id=integer(req.params.id);if(!id)return fail(res,400,"Phiếu đặt hàng không hợp lệ.");const data=await orderData(id);if(!data[0][0])return fail(res,404,"Không tìm thấy phiếu đặt hàng.");res.json({success:true,data:{...data[0][0],items:data[1]}})}catch(error){next(error)}}
async function create(req,res,next){let transaction;try{
  const error=validate(req.body);if(error)return fail(res,400,error);const pool=await getPool();transaction=new sql.Transaction(pool);await transaction.begin();
  await ensureLinks(new sql.Request(transaction),req.body);const temp=`TMP-${Date.now()}`;
  const inserted=await new sql.Request(transaction).input("code",sql.VarChar(50),temp).input("supplier",sql.Int,Number(req.body.supplierId)).input("branch",sql.Int,Number(req.body.branchId)).input("user",sql.Int,req.user.userId).input("date",sql.Date,req.body.orderDate||new Date()).input("note",sql.NVarChar(500),clean(req.body.note)||null).query("INSERT supplier_purchase_orders(order_code,supplier_id,branch_id,created_by,order_date,note,status) OUTPUT INSERTED.id VALUES(@code,@supplier,@branch,@user,@date,@note,'draft')");
  const id=inserted.recordset[0].id,code=`PDH-${new Date().toISOString().slice(0,10).replaceAll("-","")}-${String(id).padStart(5,"0")}`;
  await new sql.Request(transaction).input("id",sql.Int,id).input("code",sql.VarChar(50),code).query("UPDATE supplier_purchase_orders SET order_code=@code WHERE id=@id");await replaceItems(transaction,id,itemsOf(req.body));await transaction.commit();res.status(201).json({success:true,message:"Đã tạo phiếu đặt hàng nhà cung cấp.",data:{orderId:id,orderCode:code}});
}catch(error){if(transaction)try{await transaction.rollback()}catch{};if(error.status)return fail(res,error.status,error.message);next(error)}}
async function update(req,res,next){let transaction;try{
  const id=integer(req.params.id),error=validate(req.body);if(!id||error)return fail(res,400,error||"Phiếu đặt hàng không hợp lệ.");const pool=await getPool();transaction=new sql.Transaction(pool);await transaction.begin();
  const state=(await new sql.Request(transaction).input("id",sql.Int,id).query("SELECT status FROM supplier_purchase_orders WITH(UPDLOCK,HOLDLOCK) WHERE id=@id")).recordset[0];if(!state)throw Object.assign(new Error("Không tìm thấy phiếu đặt hàng."),{status:404});if(state.status!=="draft")throw Object.assign(new Error("Chỉ được sửa phiếu đặt hàng nháp."),{status:409});
  await ensureLinks(new sql.Request(transaction),req.body);await new sql.Request(transaction).input("id",sql.Int,id).input("supplier",sql.Int,Number(req.body.supplierId)).input("branch",sql.Int,Number(req.body.branchId)).input("date",sql.Date,req.body.orderDate||new Date()).input("note",sql.NVarChar(500),clean(req.body.note)||null).query("UPDATE supplier_purchase_orders SET supplier_id=@supplier,branch_id=@branch,order_date=@date,note=@note,updated_at=SYSDATETIME() WHERE id=@id");await replaceItems(transaction,id,itemsOf(req.body));await transaction.commit();res.json({success:true,message:"Đã cập nhật phiếu đặt hàng."});
}catch(error){if(transaction)try{await transaction.rollback()}catch{};if(error.status)return fail(res,error.status,error.message);next(error)}}
async function remove(req,res,next){try{const id=integer(req.params.id);if(!id)return fail(res,400,"Phiếu đặt hàng không hợp lệ.");const result=await (await getPool()).request().input("id",sql.Int,id).query("DELETE supplier_purchase_orders WHERE id=@id AND status='draft'; SELECT @@ROWCOUNT affected");if(!result.recordset[0].affected)return fail(res,409,"Chỉ được xóa phiếu đặt hàng nháp.");res.json({success:true,message:"Đã xóa phiếu đặt hàng."})}catch(error){next(error)}}
async function excel(req,res,next){try{const id=integer(req.params.id),data=await orderData(id);if(!data[0][0])return fail(res,404,"Không tìm thấy phiếu đặt hàng.");const order=data[0][0],items=data[1],book=new ExcelJS.Workbook(),sheet=book.addWorksheet("Đơn đặt hàng");sheet.mergeCells("A1:E1");sheet.getCell("A1").value=`ĐƠN ĐẶT HÀNG NVL ${order.branchName.toUpperCase()}`;sheet.getCell("A1").font={bold:true,size:14};sheet.getCell("A1").alignment={horizontal:"center"};sheet.addRow(["Mã phiếu",order.orderCode,"Ngày đặt",new Date(order.orderDate).toLocaleDateString("vi-VN")]);sheet.addRow(["Nhà cung cấp",order.supplierName,"Chi nhánh",order.branchName]);sheet.addRow([]);sheet.addRow(["STT","Mã NVL","Tên NVL","ĐVT","Số lượng đặt"]);items.forEach((item,index)=>sheet.addRow([index+1,item.productCode,item.productName,item.unitName,Number(item.quantity)]));sheet.addRow([]);sheet.addRow(["Ghi chú",order.note||""]);sheet.columns=[{width:8},{width:18},{width:48},{width:16},{width:16}];sheet.getRow(4).font={bold:true};sheet.getRow(4).eachCell(cell=>{cell.fill={type:"pattern",pattern:"solid",fgColor:{argb:"FFFFE600"}};cell.border={top:{style:"thin"},left:{style:"thin"},bottom:{style:"thin"},right:{style:"thin"}}});res.set({"Content-Type":"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet","Content-Disposition":`attachment; filename="${order.orderCode}.xlsx"`});await book.xlsx.write(res);res.end()}catch(error){next(error)}}
async function pdf(req,res,next){try{const id=integer(req.params.id),data=await orderData(id);if(!data[0][0])return fail(res,404,"Không tìm thấy phiếu đặt hàng.");const order=data[0][0],items=data[1],doc=new PDFDocument({size:"A4",layout:"landscape",margin:35}),font="C:/Windows/Fonts/arial.ttf";if(fs.existsSync(font))doc.font(font);res.set({"Content-Type":"application/pdf","Content-Disposition":`attachment; filename="${order.orderCode}.pdf"`});doc.pipe(res);doc.fontSize(16).text(`ĐƠN ĐẶT HÀNG NVL ${order.branchName.toUpperCase()}`,{align:"center"}).moveDown(.5).fontSize(10).text(`Mã phiếu: ${order.orderCode}   |   Ngày đặt: ${new Date(order.orderDate).toLocaleDateString("vi-VN")}`).text(`Nhà cung cấp: ${order.supplierName}   |   Chi nhánh: ${order.branchName}`).moveDown();doc.fontSize(9).text("STT   MÃ NVL          TÊN NGUYÊN LIỆU                                                ĐVT                 SỐ LƯỢNG ĐẶT");doc.moveTo(35,doc.y+3).lineTo(807,doc.y+3).stroke();items.forEach((item,index)=>doc.moveDown(.55).text(`${String(index+1).padEnd(5)} ${String(item.productCode||"").padEnd(15)} ${String(item.productName||"").slice(0,52).padEnd(54)} ${String(item.unitName||"").slice(0,16).padEnd(18)} ${Number(item.quantity).toLocaleString("vi-VN")}`));if(order.note)doc.moveDown().text(`Ghi chú: ${order.note}`);doc.end()}catch(error){next(error)}}
module.exports={list,detail,create,update,remove,excel,pdf};
