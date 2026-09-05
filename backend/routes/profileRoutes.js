const router = require("express").Router();
const authenticate = require("../middleware/authMiddleware");
const uploadAvatar = require("../middleware/profileAvatarUpload");
const { getProfile,updatePersonalProfile,updateAvatar } = require("../controllers/profileController");
router.get("/", authenticate, getProfile);
router.put("/personal",authenticate,updatePersonalProfile);
router.post("/avatar",authenticate,uploadAvatar.single("avatar"),updateAvatar);
module.exports = router;
