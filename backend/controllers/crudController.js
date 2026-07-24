const { getModel } = require("../models");
const handler = fn => async(req,res,next)=>{try{return await fn(req,res)}catch(error){return next(error)}};

function createCrudController(modelName){return {
  list:handler(async(req,res)=>{const model=await getModel(modelName),result=await model.findAll(req.query);res.json({success:true,...result})}),
  get:handler(async(req,res)=>{const model=await getModel(modelName),data=await model.findById(req.params.id);if(!data)return res.status(404).json({success:false,message:"Không tìm thấy dữ liệu"});res.json({success:true,data})}),
  create:handler(async(req,res)=>{const model=await getModel(modelName),data=await model.create(req.body);res.status(201).json({success:true,message:"Tạo dữ liệu thành công",data})}),
  update:handler(async(req,res)=>{const model=await getModel(modelName),data=await model.update(req.params.id,req.body);if(!data)return res.status(404).json({success:false,message:"Không tìm thấy dữ liệu"});res.json({success:true,message:"Cập nhật dữ liệu thành công",data})}),
  remove:handler(async(req,res)=>{const model=await getModel(modelName),data=await model.delete(req.params.id);if(!data)return res.status(404).json({success:false,message:"Không tìm thấy dữ liệu"});res.json({success:true,message:"Xóa dữ liệu thành công",data})}),
}}
module.exports={createCrudController};
