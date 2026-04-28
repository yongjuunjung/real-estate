import type { Config } from "drizzle-kit";

export default {
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "",
  },
  // 같은 Supabase DB의 다른 schema(public 등)를 건드리지 않도록 jungnang schema에만 한정.
  schemaFilter: ["jungnang"],
  strict: true,
  verbose: true,
} satisfies Config;
