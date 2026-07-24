const router = require("express").Router();
const authenticate = require("../middleware/authMiddleware");
const { getOrders, createOrder, updateOrderStatus } = require("../controllers/orderController");
router.use(authenticate);
router.get("/", getOrders);
router.post("/", createOrder);
router.put("/:id/status", updateOrderStatus);
module.exports = router;
