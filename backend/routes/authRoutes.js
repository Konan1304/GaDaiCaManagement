const router = require("express").Router();
const { login, requestPasswordReset } = require("../controllers/authController");
router.post("/login", login);
router.post("/forgot-password", requestPasswordReset);
module.exports = router;
