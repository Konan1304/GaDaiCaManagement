const express = require("express");

const router = express.Router();

router.get("/", (req, res) => {
    res.json({
        success: true,
        message: "Danh sách ca làm",
        data: []
    });
});

module.exports = router;