const express = require("express");

const router = express.Router();

router.get("/", (req, res) => {
    res.json({
        success: true,
        message: "Danh sách nhân viên",
        data: []
    });
});

module.exports = router;