const multer=require("multer"),path=require("path"),crypto=require("crypto"),fs=require("fs");
const root=path.resolve(__dirname,"../uploads/sandbox/operations");fs.mkdirSync(root,{recursive:true});
const allowed=new Set(["image/jpeg","image/png","image/webp"]);
module.exports=multer({storage:multer.diskStorage({destination:root,filename:(req,file,cb)=>cb(null,`${crypto.randomUUID()}${({"image/jpeg":".jpg","image/png":".png","image/webp":".webp"})[file.mimetype]||""}`)}),limits:{fileSize:5*1024*1024,files:1},fileFilter:(req,file,cb)=>allowed.has(file.mimetype)?cb(null,true):cb(Object.assign(new Error("Chỉ chấp nhận ảnh JPEG, PNG hoặc WebP"),{status:400}))});
module.exports.root=root;
