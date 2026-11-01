import { countPasses, initSchema, pool } from "./db.ts";

try {
  await initSchema();
  const count = await countPasses();
  console.log(`Connected. passes table is ready (${count} rows).`);
} finally {
  await pool.end();
}
