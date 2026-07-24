const router = require("express").Router();
const authenticate = require("../middleware/authMiddleware");
const { getProfile } = require("../controllers/profileController");
router.get("/", authenticate, getProfile);
module.exports = router;
