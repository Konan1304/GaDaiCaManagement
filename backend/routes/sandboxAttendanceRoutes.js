const router=require("express").Router();
const authenticate=require("../middleware/authMiddleware");
const allowRoles=require("../middleware/roleMiddleware");
const controller=require("../controllers/sandboxAttendanceController");

router.use(authenticate,allowRoles("admin","manager"));
router.get("/options",controller.options);
router.get("/schedules",controller.schedules);
router.post("/generate",controller.generate);

module.exports=router;
