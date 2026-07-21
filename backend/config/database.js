const sql = require("mssql");

const databaseConfig = {
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    server: process.env.DB_SERVER,
    database: process.env.DB_DATABASE,
    options: {
        encrypt: false,
        trustServerCertificate: true
    }
};

let pool;

async function connectDatabase() {
    try {
        pool = await sql.connect(databaseConfig);
        console.log("Kết nối SQL Server thành công");
        return pool;
    } catch (error) {
        console.error("Kết nối SQL Server thất bại:", error.message);
        throw error;
    }
}

function getPool() {
    if (!pool) {
        throw new Error("Database chưa được kết nối");
    }

    return pool;
}

module.exports = {
    sql,
    connectDatabase,
    getPool
};