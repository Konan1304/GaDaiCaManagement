const express=require("express");
const authenticate=require("../middleware/authMiddleware");
const allowRoles=require("../middleware/roleMiddleware");
const {createCrudController}=require("../controllers/crudController");

function createCrudRouter(modelName,{readRoles=["admin","manager"],writeRoles=["admin","manager"]}={}){
  const router=express.Router(),controller=createCrudController(modelName);
  router.use(authenticate);
  router.get("/",allowRoles(...readRoles),controller.list);
  router.get("/:id",allowRoles(...readRoles),controller.get);
  router.post("/",allowRoles(...writeRoles),controller.create);
  router.put("/:id",allowRoles(...writeRoles),controller.update);
  router.delete("/:id",allowRoles(...writeRoles),controller.remove);
  return router;
}
module.exports={createCrudRouter};
