const {sql,getPool}=require("../config/db");
const fail=(res,status,message)=>res.status(status).json({success:false,message});
const statuses=new Set(["active","inactive"]);
const text=value=>String(value||"").trim();

async function list(req,res,next){try{
  const page=Math.max(1,Number.parseInt(req.query.page,10)||1);
  const limit=Math.min(100,Math.max(1,Number.parseInt(req.query.limit,10)||10));
  const search=text(req.query.search),status=text(req.query.status);
  const request=(await getPool()).request().input("offset",sql.Int,(page-1)*limit).input("limit",sql.Int,limit);
  const where=[];
  if(search){where.push("(c.category_name LIKE @search OR c.description LIKE @search)");request.input("search",sql.NVarChar(510),`%${search}%`)}
  if(statuses.has(status)){where.push("c.status=@status");request.input("status",sql.VarChar(20),status)}
  if(String(req.query.activeOnly)==="true")where.push("c.status='active'");
  const clause=where.length?`WHERE ${where.join(" AND ")}`:"";
  const result=await request.query(`
    SELECT c.id AS categoryId,c.category_code AS categoryCode,c.category_name AS categoryName,
      c.description,c.status,CONVERT(char(19),c.created_at,126) AS createdAt,COUNT(p.id) AS productCount
    FROM categories c LEFT JOIN products p ON p.category_id=c.id
    ${clause}
    GROUP BY c.id,c.category_code,c.category_name,c.description,c.status,c.created_at
    ORDER BY CASE c.category_name
      WHEN N'Nguyên liệu' THEN 1 WHEN N'Bột' THEN 2 WHEN N'Sốt' THEN 3
      WHEN N'Đồ uống' THEN 4 WHEN N'Thực phẩm ăn kèm' THEN 5 WHEN N'Bao bì' THEN 6 ELSE 99 END,c.created_at,c.id
    OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY;
    SELECT COUNT(*) AS total FROM categories c ${clause};`);
  const total=Number(result.recordsets[1][0].total||0);
  res.json({success:true,data:{items:result.recordsets[0],pagination:{page,limit,total,totalPages:Math.max(1,Math.ceil(total/limit))}}});
}catch(error){next(error)}}

async function detail(req,res,next){try{
  const id=Number(req.params.id);if(!Number.isInteger(id))return fail(res,400,"Danh mục không hợp lệ.");
  const result=await (await getPool()).request().input("id",sql.Int,id).query(`
    SELECT c.id AS categoryId,c.category_code AS categoryCode,c.category_name AS categoryName,c.description,c.status,
      CONVERT(char(19),c.created_at,126) AS createdAt,COUNT(p.id) AS productCount
    FROM categories c LEFT JOIN products p ON p.category_id=c.id WHERE c.id=@id
    GROUP BY c.id,c.category_code,c.category_name,c.description,c.status,c.created_at;
    SELECT id AS productId,product_code AS productCode,product_name AS productName,status
    FROM products WHERE category_id=@id ORDER BY product_name;`);
  if(!result.recordsets[0][0])return fail(res,404,"Không tìm thấy danh mục.");
  res.json({success:true,data:{...result.recordsets[0][0],products:result.recordsets[1]}});
}catch(error){next(error)}}

function validate(body){
  const name=text(body.categoryName),description=text(body.description),status=body.status||"active";
  if(!name)return "Tên danh mục là bắt buộc.";
  if(name.length>150)return "Tên danh mục không được quá 150 ký tự.";
  if(description.length>500)return "Mô tả không được quá 500 ký tự.";
  if(!statuses.has(status))return "Trạng thái danh mục không hợp lệ.";
  return null;
}
const codeFromId=id=>`DM${String(id).padStart(3,"0")}`;

async function create(req,res,next){try{
  const error=validate(req.body);if(error)return fail(res,400,error);
  const name=text(req.body.categoryName),description=text(req.body.description)||null,status=req.body.status||"active",pool=await getPool();
  const duplicate=await pool.request().input("name",sql.NVarChar(150),name).query("SELECT id FROM categories WHERE LOWER(LTRIM(RTRIM(category_name)))=LOWER(@name)");
  if(duplicate.recordset[0])return fail(res,409,"Tên danh mục đã tồn tại.");
  const tx=new sql.Transaction(pool);let started=false;
  try{await tx.begin();started=true;
    const inserted=await new sql.Request(tx).input("name",sql.NVarChar(150),name).input("description",sql.NVarChar(500),description)
      .input("status",sql.VarChar(20),status).query(`INSERT categories(category_code,category_name,category_type,description,status)
        OUTPUT INSERTED.id VALUES(CONCAT('TMP-',RIGHT(CONVERT(varchar(36),NEWID()),20)),@name,'ingredient',@description,@status)`);
    const id=inserted.recordset[0].id;
    await new sql.Request(tx).input("id",sql.Int,id).input("code",sql.VarChar(30),codeFromId(id)).query("UPDATE categories SET category_code=@code WHERE id=@id");
    await tx.commit();started=false;res.status(201).json({success:true,message:"Thêm danh mục thành công.",data:{categoryId:id}});
  }catch(error){if(started)await tx.rollback().catch(()=>{});throw error}
}catch(error){if(error.number===2601||error.number===2627)return fail(res,409,"Tên hoặc mã danh mục đã tồn tại.");next(error)}}

async function update(req,res,next){try{
  const id=Number(req.params.id),error=validate(req.body);if(!Number.isInteger(id)||error)return fail(res,400,error||"Danh mục không hợp lệ.");
  const request=(await getPool()).request().input("id",sql.Int,id).input("name",sql.NVarChar(150),text(req.body.categoryName))
    .input("description",sql.NVarChar(500),text(req.body.description)||null).input("status",sql.VarChar(20),req.body.status||"active");
  const result=await request.query(`IF EXISTS(SELECT 1 FROM categories WHERE id<>@id AND LOWER(LTRIM(RTRIM(category_name)))=LOWER(@name))
      THROW 51001,N'Tên danh mục đã tồn tại.',1;
    UPDATE categories SET category_name=@name,description=@description,status=@status WHERE id=@id;
    SELECT @@ROWCOUNT AS affected;`);
  if(!result.recordset[0].affected)return fail(res,404,"Không tìm thấy danh mục.");
  res.json({success:true,message:"Cập nhật danh mục thành công."});
}catch(error){if(error.number===51001||error.number===2601||error.number===2627)return fail(res,409,"Tên danh mục đã tồn tại.");next(error)}}

async function remove(req,res,next){try{
  const id=Number(req.params.id);if(!Number.isInteger(id))return fail(res,400,"Danh mục không hợp lệ.");
  const result=await (await getPool()).request().input("id",sql.Int,id).query(`
    IF EXISTS(SELECT 1 FROM products WHERE category_id=@id)
      THROW 51002,N'Danh mục đang chứa sản phẩm, vui lòng chuyển hoặc xóa sản phẩm trước.',1;
    DELETE FROM categories WHERE id=@id;SELECT @@ROWCOUNT AS affected;`);
  if(!result.recordset[0].affected)return fail(res,404,"Không tìm thấy danh mục.");
  res.json({success:true,message:"Xóa danh mục thành công."});
}catch(error){if(error.number===51002||error.number===547)return fail(res,409,"Danh mục đang chứa sản phẩm, vui lòng chuyển hoặc xóa sản phẩm trước.");next(error)}}

module.exports={list,detail,create,update,remove};
