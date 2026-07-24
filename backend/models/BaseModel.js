const bcrypt = require("bcrypt");
const { getPool } = require("../config/db");

class BaseModel {
  constructor(tableName, schema) {
    this.tableName = tableName;
    this.columns = new Set(schema.map(column => column.columnName));
    this.writableColumns = new Set(schema.filter(column => !column.isIdentity && !column.isComputed).map(column => column.columnName));
    this.primaryKey = schema.find(column => column.isPrimaryKey)?.columnName || "id";
  }

  sanitize(row) {
    if (!row) return row;
    if (this.tableName === "users") { const { password_hash, ...safe } = row; return safe; }
    return row;
  }

  async preparePayload(payload) {
    const data = { ...payload };
    if (this.tableName === "users" && data.password) {
      data.password_hash = await bcrypt.hash(String(data.password), 12);
      delete data.password;
    }
    return Object.fromEntries(Object.entries(data).filter(([key]) => this.writableColumns.has(key)));
  }

  async findAll({ page=1, limit=100 }={}) {
    const safePage=Math.max(1,Number(page)||1),safeLimit=Math.min(500,Math.max(1,Number(limit)||100));
    const pool=await getPool();
    const result=await pool.request().input("offset",(safePage-1)*safeLimit).input("limit",safeLimit)
      .query(`SELECT *, COUNT_BIG(*) OVER() AS _total FROM [dbo].[${this.tableName}] ORDER BY [${this.primaryKey}] OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY`);
    const total=Number(result.recordset[0]?._total||0);
    return { data:result.recordset.map(({_total,...row})=>this.sanitize(row)),pagination:{page:safePage,limit:safeLimit,total} };
  }

  async findById(id) {
    const pool=await getPool(),request=pool.request().input("id",id);
    const result=await request.query(`SELECT * FROM [dbo].[${this.tableName}] WHERE [${this.primaryKey}]=@id`);
    return this.sanitize(result.recordset[0]||null);
  }

  async create(payload) {
    const data=await this.preparePayload(payload),entries=Object.entries(data);
    if (!entries.length) throw Object.assign(new Error("Không có dữ liệu hợp lệ để tạo"),{statusCode:400});
    const pool=await getPool(),request=pool.request();
    entries.forEach(([key,value],index)=>request.input(`v${index}`,value));
    const columns=entries.map(([key])=>`[${key}]`).join(","),values=entries.map((_,index)=>`@v${index}`).join(",");
    const result=await request.query(`INSERT INTO [dbo].[${this.tableName}] (${columns}) OUTPUT INSERTED.* VALUES (${values})`);
    return this.sanitize(result.recordset[0]);
  }

  async update(id,payload) {
    const data=await this.preparePayload(payload),entries=Object.entries(data);
    if (!entries.length) throw Object.assign(new Error("Không có dữ liệu hợp lệ để cập nhật"),{statusCode:400});
    const pool=await getPool(),request=pool.request().input("id",id);
    entries.forEach(([key,value],index)=>request.input(`v${index}`,value));
    const set=entries.map(([key],index)=>`[${key}]=@v${index}`).join(",");
    const result=await request.query(`UPDATE [dbo].[${this.tableName}] SET ${set} OUTPUT INSERTED.* WHERE [${this.primaryKey}]=@id`);
    return this.sanitize(result.recordset[0]||null);
  }

  async delete(id) {
    const pool=await getPool();
    const result=await pool.request().input("id",id).query(`DELETE FROM [dbo].[${this.tableName}] OUTPUT DELETED.[${this.primaryKey}] AS id WHERE [${this.primaryKey}]=@id`);
    return result.recordset[0]||null;
  }
}

module.exports=BaseModel;
