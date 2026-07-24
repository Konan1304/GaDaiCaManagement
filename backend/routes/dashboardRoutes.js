const router = require("express").Router();
const authenticate = require("../middleware/authMiddleware");
const allowRoles = require("../middleware/roleMiddleware");
const { getDashboard } = require("../controllers/dashboardController");
router.get("/", authenticate, allowRoles("admin","manager"), getDashboard);
module.exports = router;
