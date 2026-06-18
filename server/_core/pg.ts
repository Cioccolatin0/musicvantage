import pg from "pg";

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL || "postgresql://musicvantage:musicvantage@localhost:5432/musicvantage",
  max: 10,
});

pool.on("error", (err) => {
  console.error("[PG] Pool error:", err.message);
});

export async function query(sql: string, params?: any[]): Promise<any[]> {
  const result = await pool.query(sql, params);
  return result.rows;
}

export async function queryOne(sql: string, params?: any[]): Promise<any | undefined> {
  const rows = await query(sql, params);
  return rows[0];
}

export async function run(sql: string, params?: any[]): Promise<{ rowCount: number; rows: any[] }> {
  const result = await pool.query(sql, params);
  return { rowCount: result.rowCount ?? 0, rows: result.rows };
}

export default pool;
