const express = require("express");

const router = express.Router();

router.get("/", (req, res) => {
    res.json({
        success: true,
        message: "Danh sách lịch làm",
        data: []
    });
});

module.exports = router;