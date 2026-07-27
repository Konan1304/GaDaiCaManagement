const {sql,getPool}=require("../config/db");
const statuses=new Set(["active","inactive"]);
const clean=value=>String(value||"").trim();
const nullable=value=>clean(value)||null;
const fail=(res,status,message)=>res.status(status).json({success:false,message});

async function list(req,res,next){try{
 const page=Math.max(1,parseInt(req.query.page,10)||1),limit=Math.min(100,Math.max(1,parseInt(req.query.limit,10)||10));
 const request=(await getPool()).request().input("offset",sql.Int,(page-1)*limit).input("limit",sql.Int,limit),where=[];
 const search=clean(req.query.search),status=clean(req.query.status),group=clean(req.query.group);
 if(search){where.push("(s.supplier_name LIKE @search OR s.display_name LIKE @search OR s.supplier_code LIKE @search OR s.tax_code LIKE @search)");request.input("search",sql.NVarChar(510),`%${search}%`)}
 if(statuses.has(status)){where.push("s.status=@status");request.input("status",sql.VarChar(20),status)}
 if(group){where.push("s.supplier_group=@group");request.input("group",sql.NVarChar(200),group)}
 if(String(req.query.activeOnly)==="true")where.push("s.status='active'");
 const clause=where.length?`WHERE ${where.join(" AND ")}`:"";
 const result=await request.query(`
  SELECT s.id AS supplierId,s.supplier_code AS supplierCode,s.supplier_name AS supplierName,s.display_name AS displayName,
   s.supplier_group AS supplierGroup,s.supplied_items AS suppliedItems,s.contact_name AS contactPerson,s.phone,s.email,s.address,
   s.tax_code AS taxCode,s.notes,s.status,CONVERT(char(19),s.created_at,126) AS createdAt,
   COUNT(pr.id) AS receiptCount,MAX(pr.receipt_date) AS lastReceiptAt,COALESCE(SUM(pr.total_amount),0) AS totalImportValue
  FROM suppliers s LEFT JOIN purchase_receipts pr ON pr.supplier_id=s.id ${clause}
  GROUP BY s.id,s.supplier_code,s.supplier_name,s.display_name,s.supplier_group,s.supplied_items,s.contact_name,s.phone,s.email,s.address,s.tax_code,s.notes,s.status,s.created_at
  ORDER BY s.created_at,s.id OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY;
  SELECT COUNT(*) total FROM suppliers s ${clause};
  SELECT DISTINCT supplier_group supplierGroup FROM suppliers WHERE NULLIF(supplier_group,'') IS NOT NULL ORDER BY supplier_group;`);
 const total=Number(result.recordsets[1][0].total||0);
 res.json({success:true,data:{items:result.recordsets[0],groups:result.recordsets[2],pagination:{page,limit,total,totalPages:Math.max(1,Math.ceil(total/limit))}}});
}catch(error){next(error)}}

async function detail(req,res,next){try{
 const id=Number(req.params.id);if(!Number.isInteger(id))return fail(res,400,"Nhà cung cấp không hợp lệ.");
 const result=await (await getPool()).request().input("id",sql.Int,id).query(`
  SELECT s.id AS supplierId,s.supplier_code AS supplierCode,s.supplier_name AS supplierName,s.display_name AS displayName,
   s.supplier_group AS supplierGroup,s.supplied_items AS suppliedItems,s.contact_name AS contactPerson,s.phone,s.email,s.address,
   s.tax_code AS taxCode,s.notes,s.status,CONVERT(char(19),s.created_at,126) AS createdAt,
   COUNT(pr.id) AS receiptCount,MAX(pr.receipt_date) AS lastReceiptAt,COALESCE(SUM(pr.total_amount),0) AS totalImportValue
  FROM suppliers s LEFT JOIN purchase_receipts pr ON pr.supplier_id=s.id WHERE s.id=@id
  GROUP BY s.id,s.supplier_code,s.supplier_name,s.display_name,s.supplier_group,s.supplied_items,s.contact_name,s.phone,s.email,s.address,s.tax_code,s.notes,s.status,s.created_at;
  SELECT TOP 20 receipt_code AS receiptCode,receipt_date AS receiptDate,total_amount AS totalAmount,status
  FROM purchase_receipts WHERE supplier_id=@id ORDER BY receipt_date DESC;`);
 if(!result.recordsets[0][0])return fail(res,404,"Không tìm thấy nhà cung cấp.");
 res.json({success:true,data:{...result.recordsets[0][0],receipts:result.recordsets[1]}});
}catch(error){next(error)}}

function validate(body){
 if(!clean(body.supplierName))return "Tên nhà cung cấp là bắt buộc.";
 if(body.status&&!statuses.has(body.status))return "Trạng thái không hợp lệ.";
 if(clean(body.email)&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean(body.email)))return "Email không hợp lệ.";
 return null;
}
async function nextCode(pool){
 const result=await pool.request().query("SELECT ISNULL(MAX(TRY_CONVERT(int,SUBSTRING(supplier_code,4,20))),0)+1 number FROM suppliers WHERE supplier_code LIKE 'NCC%'");
 return `NCC${String(result.recordset[0].number).padStart(3,"0")}`;
}
async function duplicate(pool,id,code,taxCode){
 const request=pool.request().input("id",sql.Int,id||0).input("code",sql.VarChar(30),code).input("tax",sql.VarChar(50),taxCode);
 return (await request.query("SELECT TOP 1 supplier_code code,tax_code tax FROM suppliers WHERE id<>@id AND (supplier_code=@code OR (@tax IS NOT NULL AND tax_code=@tax))")).recordset[0];
}
function bind(request,body,code){
 return request.input("code",sql.VarChar(30),code).input("name",sql.NVarChar(200),clean(body.supplierName))
  .input("display",sql.NVarChar(200),nullable(body.displayName)).input("group",sql.NVarChar(200),nullable(body.supplierGroup))
  .input("items",sql.NVarChar(1000),nullable(body.suppliedItems)).input("contact",sql.NVarChar(150),nullable(body.contactPerson))
  .input("phone",sql.VarChar(20),nullable(body.phone)).input("email",sql.VarChar(150),nullable(body.email))
  .input("address",sql.NVarChar(300),nullable(body.address)).input("tax",sql.VarChar(50),nullable(body.taxCode))
  .input("notes",sql.NVarChar(1000),nullable(body.notes)).input("status",sql.VarChar(20),body.status||"active");
}
async function create(req,res,next){try{
 const error=validate(req.body);if(error)return fail(res,400,error);
 const pool=await getPool(),code=clean(req.body.supplierCode)||await nextCode(pool),tax=nullable(req.body.taxCode),found=await duplicate(pool,0,code,tax);
 if(found)return fail(res,409,found.code===code?"Mã nhà cung cấp đã tồn tại.":"Mã số thuế đã tồn tại.");
 const result=await bind(pool.request(),req.body,code).query(`INSERT suppliers(supplier_code,supplier_name,display_name,supplier_group,supplied_items,
  contact_name,phone,email,address,tax_code,notes,status) OUTPUT INSERTED.id VALUES(@code,@name,@display,@group,@items,@contact,@phone,@email,@address,@tax,@notes,@status)`);
 res.status(201).json({success:true,message:"Thêm nhà cung cấp thành công.",data:{supplierId:result.recordset[0].id}});
}catch(error){if(error.number===2601||error.number===2627)return fail(res,409,"Mã nhà cung cấp hoặc mã số thuế đã tồn tại.");next(error)}}

async function update(req,res,next){try{
 const id=Number(req.params.id),error=validate(req.body);if(!Number.isInteger(id)||error)return fail(res,400,error||"Nhà cung cấp không hợp lệ.");
 const pool=await getPool(),code=clean(req.body.supplierCode),tax=nullable(req.body.taxCode);if(!code)return fail(res,400,"Mã nhà cung cấp là bắt buộc.");
 const found=await duplicate(pool,id,code,tax);if(found)return fail(res,409,found.code===code?"Mã nhà cung cấp đã tồn tại.":"Mã số thuế đã tồn tại.");
 const result=await bind(pool.request().input("id",sql.Int,id),req.body,code).query(`UPDATE suppliers SET supplier_code=@code,supplier_name=@name,
  display_name=@display,supplier_group=@group,supplied_items=@items,contact_name=@contact,phone=@phone,email=@email,address=@address,
  tax_code=@tax,notes=@notes,status=@status,updated_at=SYSDATETIME() WHERE id=@id;SELECT @@ROWCOUNT affected;`);
 if(!result.recordset[0].affected)return fail(res,404,"Không tìm thấy nhà cung cấp.");
 res.json({success:true,message:"Cập nhật nhà cung cấp thành công."});
}catch(error){next(error)}}

async function remove(req,res,next){try{
 const id=Number(req.params.id);if(!Number.isInteger(id))return fail(res,400,"Nhà cung cấp không hợp lệ.");
 const result=await (await getPool()).request().input("id",sql.Int,id).query(`
  IF EXISTS(SELECT 1 FROM purchase_receipts WHERE supplier_id=@id) THROW 51003,N'Nhà cung cấp đã phát sinh giao dịch nhập hàng nên không thể xóa.',1;
  DELETE suppliers WHERE id=@id;SELECT @@ROWCOUNT affected;`);
 if(!result.recordset[0].affected)return fail(res,404,"Không tìm thấy nhà cung cấp.");
 res.json({success:true,message:"Xóa nhà cung cấp thành công."});
}catch(error){if(error.number===51003||error.number===547)return fail(res,409,"Nhà cung cấp đã phát sinh giao dịch nhập hàng nên không thể xóa.");next(error)}}
module.exports={list,detail,create,update,remove};
