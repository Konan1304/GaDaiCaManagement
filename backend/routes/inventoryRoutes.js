const router = require("express").Router();
const authenticate = require("../middleware/authMiddleware");
const allowRoles = require("../middleware/roleMiddleware");
const controller = require("../controllers/inventoryController");

router.use(authenticate, allowRoles("admin", "manager"));
router.get("/", controller.list);
router.get("/transactions", controller.transactions);
router.post("/exports", controller.createExport);
router.get("/:productId/history", controller.detail);

module.exports = router;
