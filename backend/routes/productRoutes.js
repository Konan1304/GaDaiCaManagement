const router = require("express").Router();
const authenticate = require("../middleware/authMiddleware");
const allowRoles = require("../middleware/roleMiddleware");
const { getProducts, createProduct, updateProduct, deleteProduct } = require("../controllers/productController");
router.get("/", authenticate, getProducts);
router.post("/", authenticate, allowRoles("admin","manager"), createProduct);
router.put("/:id", authenticate, allowRoles("admin","manager"), updateProduct);
router.delete("/:id", authenticate, allowRoles("admin","manager"), deleteProduct);
module.exports = router;
