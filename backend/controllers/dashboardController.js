const { getPool } = require("../config/db");
async function getDashboard(req,res,next){try{const pool=await getPool();const result=await pool.request().query(`
  SELECT COALESCE(SUM(total_amount),0) AS totalRevenue, COUNT_BIG(*) AS todayOrders FROM orders WHERE CAST(created_at AS date)=CAST(GETDATE() AS date) AND status<>'cancelled';
  SELECT COUNT_BIG(*) AS activeEmployees FROM shift_sessions WHERE business_date=CAST(GETDATE() AS date) AND status='open';
  SELECT TOP 5 oi.product_id AS productId,oi.product_name AS productName,SUM(oi.quantity) AS quantitySold,SUM(oi.line_total) AS revenue FROM order_items oi INNER JOIN orders o ON o.id=oi.order_id WHERE o.status<>'cancelled' GROUP BY oi.product_id,oi.product_name ORDER BY quantitySold DESC,revenue DESC;
`);return res.json({success:true,data:{totalRevenue:result.recordsets[0][0].totalRevenue,todayOrders:Number(result.recordsets[0][0].todayOrders),activeEmployees:Number(result.recordsets[1][0].activeEmployees),topProducts:result.recordsets[2]}})}catch(error){return next(error)}}
module.exports={getDashboard};
