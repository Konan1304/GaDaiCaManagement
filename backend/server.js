require("dotenv").config();

const express = require("express");
const cors = require("cors");

const { connectDatabase } = require("./config/database");

const authRoutes = require("./routes/authRoutes");
const employeeRoutes = require("./routes/employeeRoutes");
const shiftRoutes = require("./routes/shiftRoutes");
const scheduleRoutes = require("./routes/scheduleRoutes");
const inventoryRoutes = require("./routes/inventoryRoutes");

const app = express();

app.use(cors());
app.use(express.json());

app.get("/api/health", (req, res) => {
    res.status(200).json({
        success: true,
        message: "Dai Ga API đang hoạt động"
    });
});

app.use("/api/auth", authRoutes);
app.use("/api/employees", employeeRoutes);
app.use("/api/shifts", shiftRoutes);
app.use("/api/schedules", scheduleRoutes);
app.use("/api/inventory", inventoryRoutes);

app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: "Không tìm thấy API"
    });
});

const PORT = process.env.PORT || 5000;

async function startServer() {
    try {
        await connectDatabase();

        app.listen(PORT, () => {
            console.log(`Server đang chạy tại http://localhost:${PORT}`);
        });
    } catch (error) {
        console.error("Không thể khởi động server");
        process.exit(1);
    }
}

startServer();