const router = require("express").Router();
const authenticate = require("../middleware/authMiddleware");
const { getTodayShift } = require("../controllers/shiftController");
router.get("/today", authenticate, getTodayShift);
module.exports = router;
