require("dotenv").config();
const {sql,getPool}=require("../config/db");
const suppliers=[
 {code:"NCC001",name:"CÔNG TY TNHH CB TM THỰC PHẨM T FOODS",display:"T Foods",group:"Thịt gà và thực phẩm đông lạnh",
  items:"Phi lê má đùi gà có da\nPhi lê má đùi tẩm gia vị\nGà viên",address:"156 Võ Văn Bích, xã Bình Mỹ, huyện Củ Chi, TP.HCM",tax:"0313271921"},
 {code:"NCC002",name:"CÔNG TY TNHH BÁNH GẠO HÀ VÀ HÀ",display:"Bánh Gạo Hà Và Hà",group:"Thực phẩm ăn kèm",
  items:"Bánh gạo dạng nở\nBánh gạo",address:"380/61 Lê Trọng Tấn, phường Tây Thạnh, TP.HCM",tax:"0313921295"},
 {code:"NCC003",name:"CÔNG TY CỔ PHẦN THỰC PHẨM SEN VIỆT",display:"Vietlotus Foods / Sen Việt",group:"Nguyên liệu, bột, gia vị và đồ uống",
  items:"Bột chiên gà Hàn Quốc\nDầu ăn thực vật Cái Lân\nBột trà sữa Thái đỏ\nTrà Thái chanh\nCác loại gia vị và nguyên liệu liên quan",
  address:"201/1A Nguyễn Xí, phường Bình Thạnh, TP.HCM",tax:"0310217161"},
];
(async()=>{
 const pool=await getPool(),tx=new sql.Transaction(pool);let started=false;
 try{await tx.begin();started=true;
  for(const item of suppliers)await new sql.Request(tx).input("code",sql.VarChar(30),item.code).input("name",sql.NVarChar(200),item.name)
   .input("display",sql.NVarChar(200),item.display).input("group",sql.NVarChar(200),item.group).input("items",sql.NVarChar(1000),item.items)
   .input("address",sql.NVarChar(300),item.address).input("tax",sql.VarChar(50),item.tax).query(`
    DECLARE @id int=(SELECT TOP 1 id FROM suppliers WHERE tax_code=@tax OR supplier_code=@code);
    IF @id IS NULL
      INSERT suppliers(supplier_code,supplier_name,display_name,supplier_group,supplied_items,address,tax_code,status)
      VALUES(@code,@name,@display,@group,@items,@address,@tax,'active');
    ELSE UPDATE suppliers SET
      supplier_name=CASE WHEN NULLIF(LTRIM(RTRIM(supplier_name)),'') IS NULL THEN @name ELSE supplier_name END,
      display_name=COALESCE(NULLIF(display_name,''),@display),supplier_group=COALESCE(NULLIF(supplier_group,''),@group),
      supplied_items=COALESCE(NULLIF(supplied_items,''),@items),address=COALESCE(NULLIF(address,''),@address),
      tax_code=COALESCE(NULLIF(tax_code,''),@tax),status='active',updated_at=SYSDATETIME() WHERE id=@id;`);
  await tx.commit();started=false;console.log("Đã seed 3 nhà cung cấp thật từ chứng từ.");
 }catch(error){if(started)await tx.rollback().catch(()=>{});throw error}finally{await pool.close()}
})().catch(error=>{console.error(error);process.exit(1)});
