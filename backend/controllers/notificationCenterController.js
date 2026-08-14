const { sql, getPool } = require("../config/db");
const isTestEnv = () => (process.env.APP_ENV === "sandbox" ? 1 : 0);

async function list(req, res, next) {
  try {
    const isTest = isTestEnv();
    const p = await getPool();
    const r = await p.request().input("uid", sql.Int, req.user.userId).input("isTest", sql.Bit, isTest).query("SELECT id,notification_type type,title,content,action_url actionUrl,priority,is_read isRead,read_at readAt,created_at createdAt FROM notifications WHERE user_id=@uid AND is_test=@isTest AND (expires_at IS NULL OR expires_at>SYSDATETIME()) ORDER BY id DESC");
    res.json({ success: true, data: r.recordset });
  } catch (e) { next(e); }
}

async function read(req, res, next) {
  try {
    const isTest = isTestEnv();
    const p = await getPool();
    await p.request().input("id", sql.BigInt, req.params.id).input("uid", sql.Int, req.user.userId).input("isTest", sql.Bit, isTest).query("UPDATE notifications SET is_read=1,read_at=SYSDATETIME() WHERE id=@id AND user_id=@uid AND is_test=@isTest");
    res.json({ success: true });
  } catch (e) { next(e); }
}

async function all(req, res, next) {
  try {
    const isTest = isTestEnv();
    const p = await getPool();
    await p.request().input("uid", sql.Int, req.user.userId).input("isTest", sql.Bit, isTest).query("UPDATE notifications SET is_read=1,read_at=COALESCE(read_at,SYSDATETIME()) WHERE user_id=@uid AND is_test=@isTest AND is_read=0");
    res.json({ success: true });
  } catch (e) { next(e); }
}

module.exports = { list, read, all };
