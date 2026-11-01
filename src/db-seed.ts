import { pool } from "./db.ts";

await pool.query(`
  INSERT INTO passes (id, name, document, issued_at, status)
  VALUES
    ('f81d4fae-7dec-11d0-a765-00a0c91e6bf6', 'Pero Perić', 'HR-123456789', '2026-11-10T10:15:00Z', 'ACTIVE'),
    ('6ba7b810-9dad-11d1-80b4-00c04fd430c8', 'Ana Anić', 'HR-987654321', '2026-11-01T08:00:00Z', 'CANCELLED')
  ON CONFLICT (id) DO NOTHING
`);

console.log("Samples were added to the database.");
await pool.end();
