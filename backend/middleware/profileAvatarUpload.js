const multer = require("multer");
const path = require("path");
const crypto = require("crypto");
const fs = require("fs");

const root = path.resolve(__dirname, "../uploads/profiles");
fs.mkdirSync(root, { recursive: true });
const extensions = { "image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp" };

module.exports = multer({
  storage: multer.diskStorage({
    destination: root,
    filename: (req, file, callback) => callback(null, `${req.user.userId}-${crypto.randomUUID()}${extensions[file.mimetype] || ""}`),
  }),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, callback) => extensions[file.mimetype]
    ? callback(null, true)
    : callback(Object.assign(new Error("Chỉ chấp nhận ảnh JPG, PNG hoặc WebP"), { status: 400 })),
});

module.exports.root = root;
