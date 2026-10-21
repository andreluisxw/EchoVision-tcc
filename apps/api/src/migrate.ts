import { readFile } from "node:fs/promises";
import { transaction } from "./db.js";

export async function migrate(): Promise<void> {
  await transaction(async (client) => {
    await client.query("SELECT pg_advisory_xact_lock(184211)");
    await client.query(
      "CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())",
    );
    const name = "002_admin";
    const applied = await client.query(
      "SELECT 1 FROM schema_migrations WHERE name=$1",
      [name],
    );
    if (!applied.rowCount) {
      await client.query(
        await readFile(
          new URL(
            "../../../infra/db/migrations/002_admin.sql",
            import.meta.url,
          ),
          "utf8",
        ),
      );
      await client.query("INSERT INTO schema_migrations(name) VALUES($1)", [
        name,
      ]);
    }
  });
}
