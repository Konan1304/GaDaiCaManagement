const { loadEnvironment } = require("./config/env");
loadEnvironment();
const express = require("express");
const cors = require("cors");
const { connectDatabase, getPool } = require("./config/db");
const { loadModels } = require("./models");
const { createCrudRouter } = require("./routes/crudRoutes");

const app = express();
app.disable("x-powered-by");
const allowedOrigins = process.env.CORS_ORIGIN.split(",").map((value) => value.trim()).filter(Boolean);
app.use(cors({ origin(origin, callback) {
  if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
  return callback(new Error(`CORS từ chối origin: ${origin}`));
}, credentials:true }));
app.use(express.json({ limit:"1mb" }));

app.get("/api/environment", async (req,res,next)=>{try{const pool=await getPool();const result=await pool.request().query(`SELECT DB_NAME() AS databaseName,SYSDATETIME() AS serverTime${process.env.APP_ENV==="sandbox"?",(SELECT business_datetime FROM dbo.sandbox_clock WHERE id=1) AS businessDateTime":""}`);res.json({success:true,appEnv:process.env.APP_ENV,databaseName:result.recordset[0].databaseName,serverTime:result.recordset[0].serverTime,businessDateTime:result.recordset[0].businessDateTime||null,sandboxInitialDateTime:process.env.SANDBOX_INITIAL_DATETIME||null,scheduleTestMode:process.env.APP_ENV==="sandbox"&&String(process.env.ENABLE_SCHEDULE_TEST_MODE).toLowerCase()==="true"})}catch(error){next(error)}});

app.get("/api/health", async (req,res,next)=>{try{const pool=await getPool();await pool.request().query("SELECT 1 AS ok");res.json({success:true,message:"Gà Đại Ca API đang hoạt động",database:"connected"})}catch(error){next(error)}});
app.use("/api/auth", require("./routes/authRoutes"));
app.use("/api/profile", require("./routes/profileRoutes"));
app.use("/api/shifts", require("./routes/shiftRoutes"));
app.use("/api/orders", require("./routes/orderRoutes"));
app.use("/api/products", require("./routes/productRoutes"));
app.use("/api/categories", require("./routes/categoryRoutes"));
app.use("/api/suppliers", require("./routes/supplierRoutes"));
app.use("/api/imports", require("./routes/importRoutes"));
app.use("/api/inventory-overview", require("./routes/inventoryRoutes"));
app.use("/api/dashboard", require("./routes/dashboardRoutes"));
app.use("/api/employee", require("./routes/employeeOperationsRoutes"));
app.use("/api/manager", require("./routes/employeeRoutes"));
app.use("/api/operations", require("./routes/shiftOperationsRoutes"));
app.use("/api/manager/operations", require("./routes/managerOperationsRoutes"));
app.use("/api/chat", require("./routes/chatRoutes"));
app.use("/api/notifications", require("./routes/notificationCenterRoutes"));
app.use("/api/shift-inventory", require("./routes/shiftInventoryRoutes"));
app.use("/api/sandbox/inventory-counts", require("./routes/shiftInventoryRoutes"));
require("./services/operationOutboxWorker").start();

if (process.env.APP_ENV === "sandbox") {
  app.use("/api/sandbox/attendance-test", require("./routes/sandboxAttendanceRoutes"));
}

// CRUD theo tên nghiệp vụ; model được introspect trực tiếp từ SQL Server.
const crudMappings = {
  users:"users", roles:"roles", branches:"branches", positions:"positions", employees:"employees",
  schedules:"schedules", attendance:"attendance",
  "import-details":"import_details", "order-items":"order_items",
  "cash-reports":"cash_reports", notifications:"notifications", settings:"settings",
  units:"units", "leave-requests":"leave_requests", "attendance-devices":"attendance_devices",
  inventory:"branch_inventories", "inventory-transactions":"inventory_transactions",
  "shift-sessions":"shift_sessions", payments:"payments", "expense-categories":"expense_categories",
  "shift-expenses":"shift_expenses",
};
for (const [route,model] of Object.entries(crudMappings)) app.use(`/api/${route}`,createCrudRouter(model));
// Bổ sung CRUD còn thiếu cho các route nghiệp vụ đã có controller riêng.
app.use("/api/shifts",createCrudRouter("shifts"));
app.use("/api/orders",createCrudRouter("orders"));
app.use("/api/products",createCrudRouter("products"));

app.use((req,res)=>res.status(404).json({success:false,message:"Không tìm thấy API"}));
app.use((error,req,res,next)=>{console.error(error);if(error.number===2601||error.number===2627)return res.status(409).json({success:false,message:"Dữ liệu đã tồn tại"});if(error.number===547)return res.status(400).json({success:false,message:"Dữ liệu liên kết không hợp lệ"});return res.status(500).json({success:false,message:process.env.NODE_ENV==="production"?"Lỗi máy chủ":error.message})});

const port=Number(process.env.PORT)||5000;
connectDatabase().then(async()=>{const models=await loadModels();console.log(`Đã map ${new Set(Object.values(models).map(model=>model.tableName)).size} bảng SQL Server`);app.listen(port,()=>console.log(`Backend đang chạy tại http://localhost:${port}`))}).catch(error=>{console.error("Không thể khởi động backend:",error.message);process.exit(1)});
module.exports=app;
