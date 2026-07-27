require("dotenv").config();
const {sql,getPool}=require("../config/db");

const categories=[
 ["DM001","Nguyên liệu","ingredient","Nguyên liệu chính dùng để chế biến món ăn."],
 ["DM002","Bột","ingredient","Các loại bột dùng trong quá trình chế biến."],
 ["DM003","Sốt","ingredient","Các loại sốt dùng cho món ăn."],
 ["DM004","Đồ uống","sale","Các sản phẩm đồ uống phục vụ khách hàng."],
 ["DM005","Thực phẩm ăn kèm","sale","Các món và thực phẩm dùng kèm."],
 ["DM006","Bao bì","packaging","Tô, ly và vật tư bao bì phục vụ bán hàng."],
];
const productCategory={
 "Gà viên":"Nguyên liệu","Dầu ăn thực vật Cái Lân 5L":"Nguyên liệu",
 "Bột chiên gà Hàn Quốc 800g":"Bột","Bột chiên gà Hàn Quốc 1,3kg":"Bột",
 "Sốt tương tỏi":"Sốt","Sốt chua cay":"Sốt","Sốt chua ngọt":"Sốt","Sốt U Mê":"Sốt","Sốt Tê Cay":"Sốt","Sốt Bơ Mật Ong":"Sốt","Sốt Phô Mai":"Sốt",
 "Trà sữa Thái đỏ":"Đồ uống","Trà Thái chanh":"Đồ uống","Coca-Cola":"Đồ uống",
 "Bánh gạo":"Thực phẩm ăn kèm",
 "Tô giấy 8oz":"Bao bì","Tô giấy 12oz":"Bao bì","Tô giấy 22oz":"Bao bì","Tô giấy 32oz":"Bao bì","Ly nhựa 14oz":"Bao bì",
};
const productSeeds=[
 ["INV001","Gà viên","Nguyên liệu","KG","ingredient"],["INV002","Dầu ăn thực vật Cái Lân 5L","Nguyên liệu","LITER","ingredient"],
 ["INV003","Bột chiên gà Hàn Quốc 800g","Bột","BAG","ingredient"],["INV004","Bột chiên gà Hàn Quốc 1,3kg","Bột","BAG","ingredient"],
 ["INV005","Sốt tương tỏi","Sốt","BOTTLE","ingredient"],["INV006","Sốt chua cay","Sốt","BOTTLE","ingredient"],
 ["INV007","Sốt chua ngọt","Sốt","BOTTLE","ingredient"],["INV008","Sốt U Mê","Sốt","BOTTLE","ingredient"],
 ["INV009","Sốt Tê Cay","Sốt","BOTTLE","ingredient"],["INV010","Sốt Bơ Mật Ong","Sốt","BOTTLE","ingredient"],
 ["INV011","Sốt Phô Mai","Sốt","BOTTLE","ingredient"],["INV012","Trà sữa Thái đỏ","Đồ uống","BOTTLE","sale_item"],
 ["INV013","Trà Thái chanh","Đồ uống","BOTTLE","sale_item"],["INV014","Coca-Cola","Đồ uống","CAN","sale_item"],
 ["INV015","Bánh gạo","Thực phẩm ăn kèm","BAG","sale_item"],["INV016","Tô giấy 8oz","Bao bì","PIECE","packaging"],
 ["INV017","Tô giấy 12oz","Bao bì","PIECE","packaging"],["INV018","Tô giấy 22oz","Bao bì","PIECE","packaging"],
 ["INV019","Tô giấy 32oz","Bao bì","PIECE","packaging"],["INV020","Ly nhựa 14oz","Bao bì","PIECE","packaging"],
];

(async()=>{
 const pool=await getPool(),tx=new sql.Transaction(pool);let started=false;
 try{
  await tx.begin();started=true;
  for(const [code,name,type,description] of categories){
   await new sql.Request(tx).input("code",sql.VarChar(30),code).input("name",sql.NVarChar(150),name)
    .input("type",sql.VarChar(30),type).input("description",sql.NVarChar(500),description).query(`
      UPDATE categories SET category_code=CONCAT('OLD-',id) WHERE category_code=@code AND category_name<>@name;
      IF EXISTS(SELECT 1 FROM categories WHERE category_name=@name)
        UPDATE categories SET category_code=@code,category_type=@type,description=@description,status='active' WHERE category_name=@name;
      ELSE INSERT categories(category_code,category_name,category_type,description,status) VALUES(@code,@name,@type,@description,'active');`);
  }
  for(const [code,name,category,unit,type] of productSeeds){
   await new sql.Request(tx).input("code",sql.VarChar(50),code).input("name",sql.NVarChar(200),name)
    .input("category",sql.NVarChar(150),category).input("unit",sql.VarChar(30),unit).input("type",sql.VarChar(30),type).query(`
      IF NOT EXISTS(SELECT 1 FROM products WHERE product_name=@name)
        INSERT products(category_id,unit_id,product_code,product_name,product_type,sale_price,cost_price,minimum_stock,status)
        SELECT c.id,u.id,@code,@name,@type,0,0,0,'active' FROM categories c CROSS JOIN units u
        WHERE c.category_name=@category AND u.unit_code=@unit;`);
  }
  for(const [productName,categoryName] of Object.entries(productCategory)){
   await new sql.Request(tx).input("product",sql.NVarChar(200),productName).input("category",sql.NVarChar(150),categoryName)
    .query("UPDATE products SET category_id=(SELECT id FROM categories WHERE category_name=@category),updated_at=SYSDATETIME() WHERE product_name=@product");
  }
  await new sql.Request(tx).query(`
    UPDATE p SET category_id=(SELECT id FROM categories WHERE category_name=N'Nguyên liệu'),updated_at=SYSDATETIME()
      FROM products p JOIN categories c ON c.id=p.category_id WHERE c.category_name=N'Gà rán';
    UPDATE p SET category_id=(SELECT id FROM categories WHERE category_name=N'Thực phẩm ăn kèm'),updated_at=SYSDATETIME()
      FROM products p JOIN categories c ON c.id=p.category_id WHERE c.category_name IN(N'Món ăn kèm',N'Ăn kèm');
    UPDATE p SET category_id=(SELECT id FROM categories WHERE category_name=N'Đồ uống'),updated_at=SYSDATETIME()
      FROM products p JOIN categories c ON c.id=p.category_id WHERE c.category_name IN(N'Nước uống',N'Đồ uống');
  `);
  const extra=await new sql.Request(tx).query(`
    SELECT c.category_name AS categoryName,COUNT(p.id) AS productCount,STRING_AGG(CONVERT(nvarchar(max),p.product_name),N', ') AS products
    FROM categories c LEFT JOIN products p ON p.category_id=c.id
    WHERE c.category_name NOT IN(N'Nguyên liệu',N'Bột',N'Sốt',N'Đồ uống',N'Thực phẩm ăn kèm',N'Bao bì')
    GROUP BY c.category_name HAVING COUNT(p.id)>0;`);
  if(extra.recordset.length)throw new Error(`Không thể xóa danh mục cũ đang chứa sản phẩm: ${extra.recordset.map(x=>`${x.categoryName}: ${x.products}`).join(" | ")}`);
  await new sql.Request(tx).query(`DELETE FROM categories WHERE category_name NOT IN
    (N'Nguyên liệu',N'Bột',N'Sốt',N'Đồ uống',N'Thực phẩm ăn kèm',N'Bao bì');`);
  await tx.commit();started=false;
  console.log("Đã khởi tạo đúng 6 danh mục kho và liên kết các sản phẩm có tên phù hợp.");
 }catch(error){if(started)await tx.rollback().catch(()=>{});throw error}
 finally{await pool.close()}
})().catch(error=>{console.error(error.message);process.exit(1)});
