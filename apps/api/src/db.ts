import pg from "pg";

const { Pool } = pg;

const databaseUrl = process.env.DATABASE_URL ?? "postgresql://psicorisk:psicorisk@localhost:5432/psicorisk";

let storageMode: "postgres" | "memory" = "postgres";

export const pool = new Pool({
  connectionString: databaseUrl
});

export function getStorageMode(): "postgres" | "memory" {
  return storageMode;
}

export async function ensureSchema(): Promise<void> {
  const maxAttempts = 12;
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS assessments (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          file_name TEXT NOT NULL,
          file_type TEXT NOT NULL,
          company_name TEXT,
          unit_name TEXT,
          rows JSONB NOT NULL,
          analytics JSONB NOT NULL,
          control_measures JSONB,
          workforce JSONB,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
      `);

      storageMode = "postgres";
      return;
    } catch (error) {
      lastError = error;
      if (attempt === maxAttempts) {
        storageMode = "memory";
        console.warn(
          "PostgreSQL indisponivel. API iniciada com armazenamento em memoria; os dados serao perdidos ao reiniciar.",
          lastError
        );
        return;
      }

      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }
}
