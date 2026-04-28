import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");

  // 마이그레이션은 prepared statements를 쓰는 DDL이라 max:1 단일 커넥션이 안전.
  const client = postgres(url, { prepare: false, max: 1 });
  const db = drizzle(client);

  console.log("[migrate] applying migrations from ./drizzle ...");
  await migrate(db, {
    migrationsFolder: "./drizzle",
    migrationsSchema: "jungnang",
    migrationsTable: "drizzle_migrations",
  });
  console.log("[migrate] done");
  await client.end();
}

main().catch((err) => {
  console.error("[migrate] failed:", err);
  process.exit(1);
});
