import dotenv from "dotenv";
import pg from "pg";

dotenv.config({ quiet: true });

const { Pool } = pg;

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing environment variable ${name}.`);
  }
  return value;
}

export const pool = new Pool({
  host: required("DB_HOST"),
  port: Number(required("DB_PORT")),
  user: required("DB_USER"),
  password: required("DB_PASSWORD"),
  database: required("DB_NAME"),
  ssl: process.env.DB_SSL === "true" ? { rejectUnauthorized: false } : false,
});

export async function initSchema(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS passes (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name TEXT NOT NULL,
      document TEXT NOT NULL,
      issued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'CANCELLED'))
    )
  `);
}

export type PassStatus = "ACTIVE" | "CANCELLED";

export type Pass = {
  id: string;
  name: string;
  document: string;
  issuedAt: Date;
  status: PassStatus;
};

type PassRow = {
  id: string;
  name: string;
  document: string;
  issued_at: Date;
  status: PassStatus;
};

function toPass(row: PassRow): Pass {
  return {
    id: row.id,
    name: row.name,
    document: row.document,
    issuedAt: row.issued_at,
    status: row.status,
  };
}

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function countPasses(): Promise<number> {
  const result = await pool.query<{ count: number }>(
    "SELECT COUNT(*)::int AS count FROM passes",
  );
  return result.rows[0].count;
}

export async function countActivePasses(): Promise<number> {
  const result = await pool.query<{ count: number }>(
    "SELECT COUNT(*)::int AS count FROM passes WHERE status = 'ACTIVE'",
  );
  return result.rows[0].count;
}

export async function listPasses(): Promise<Pass[]> {
  const result = await pool.query<PassRow>(
    `SELECT id, name, document, issued_at, status
     FROM passes
     ORDER BY issued_at DESC`,
  );
  return result.rows.map(toPass);
}

export async function cancelPass(id: string): Promise<boolean> {
  if (!uuidPattern.test(id)) {
    return false;
  }
  const result = await pool.query(
    "UPDATE passes SET status = 'CANCELLED' WHERE id = $1",
    [id],
  );
  return result.rowCount === 1;
}

export async function deletePass(id: string): Promise<boolean> {
  if (!uuidPattern.test(id)) {
    return false;
  }
  const result = await pool.query("DELETE FROM passes WHERE id = $1", [id]);
  return result.rowCount === 1;
}

export async function insertPass(name: string, document: string): Promise<Pass> {
  const result = await pool.query<PassRow>(
    `INSERT INTO passes (name, document)
     VALUES ($1, $2)
     RETURNING id, name, document, issued_at, status`,
    [name, document],
  );
  return toPass(result.rows[0]);
}

export async function findPass(id: string): Promise<Pass | null> {
  if (!uuidPattern.test(id)) {
    return null;
  }
  const result = await pool.query<PassRow>(
    "SELECT id, name, document, issued_at, status FROM passes WHERE id = $1",
    [id],
  );
  const row = result.rows[0];
  return row ? toPass(row) : null;
}
