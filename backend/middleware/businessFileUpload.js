const multer=require('multer'),path=require('path'),crypto=require('crypto'),fs=require('fs');
const root=path.resolve(__dirname,'../uploads/business');fs.mkdirSync(root,{recursive:true});
const allowed=new Set(['image/jpeg','image/png','image/webp','application/pdf','text/plain','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','application/vnd.openxmlformats-officedocument.wordprocessingml.document']);
const extensions={'image/jpeg':'.jpg','image/png':'.png','image/webp':'.webp','application/pdf':'.pdf','text/plain':'.txt','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':'.xlsx','application/vnd.openxmlformats-officedocument.wordprocessingml.document':'.docx'};
const upload=multer({storage:multer.diskStorage({destination:root,filename:(req,file,cb)=>cb(null,`${crypto.randomUUID()}${extensions[file.mimetype]||''}`)}),limits:{fileSize:10*1024*1024,files:1},fileFilter:(req,file,cb)=>allowed.has(file.mimetype)?cb(null,true):cb(Object.assign(new Error('Tệp không được hỗ trợ'),{status:400}))});
upload.root=root;module.exports=upload;
