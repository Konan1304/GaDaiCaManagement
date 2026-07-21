const express = require("express");

const router = express.Router();

router.get("/", (req, res) => {
    res.json({
        success: true,
        message: "Danh sách tồn kho",
        data: []
    });
});

module.exports = router;