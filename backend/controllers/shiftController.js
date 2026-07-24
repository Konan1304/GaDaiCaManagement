const { sql, getPool } = require("../config/db");

async function getTodayShift(req, res, next) {
  try {
    const pool = await getPool();
    const result = await pool.request().input("userId", sql.Int, req.user.userId).query(`
      SELECT TOP 1 es.id AS scheduleId, es.work_date AS workDate, es.work_position AS workPosition,
             es.status AS scheduleStatus, s.id AS shiftId, s.shift_code AS shiftCode,
             s.shift_name AS shiftName, s.start_time AS startTime, s.end_time AS endTime,
             s.break_minutes AS breakMinutes, b.id AS branchId, b.branch_name AS branchName,
             ss.id AS shiftSessionId, ss.opened_at AS openedAt, ss.closed_at AS closedAt,
             ss.opening_cash AS openingCash, ss.status AS sessionStatus
      FROM employees e
      INNER JOIN employee_schedules es ON es.employee_id = e.id AND es.work_date = CAST(GETDATE() AS date)
      INNER JOIN shifts s ON s.id = es.shift_id
      INNER JOIN branches b ON b.id = es.branch_id
      LEFT JOIN shift_sessions ss ON ss.schedule_id = es.id AND ss.employee_id = e.id
      WHERE e.user_id = @userId AND es.status <> 'cancelled'
      ORDER BY s.start_time
    `);
    return res.json({ success:true, data:result.recordset[0] || null });
  } catch (error) { return next(error); }
}

module.exports = { getTodayShift };
