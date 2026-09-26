import { readFile } from "node:fs/promises";
import path from "node:path";
import postgres from "postgres";
import { getConfig } from "./config";

// Singleton on globalThis: avoids duplicate pools across bundles and on hot reload.
const g = globalThis as unknown as { __ferrapexDb?: postgres.Sql };

export function getDb(): postgres.Sql {
  // onnotice: silence "already exists, skipping" notices from the idempotent schema.
  g.__ferrapexDb ??= postgres(getConfig().databaseUrl, { onnotice: () => {} });
  return g.__ferrapexDb;
}

// Idempotent (CREATE ... IF NOT EXISTS), run at every startup.
export async function runSchema(): Promise<void> {
  const schema = await readFile(path.join(process.cwd(), "db/schema.sql"), "utf8");
  await getDb().unsafe(schema).simple();
}
