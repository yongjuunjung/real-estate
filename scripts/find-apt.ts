import postgres from "postgres";

async function main() {
  const sql = postgres(process.env.DATABASE_URL!, { prepare: false });
  const term = process.argv[2] ?? "우디안";
  const r = await sql`
    SELECT id, name, dong FROM jungnang.apartments
    WHERE name LIKE ${'%' + term + '%'}
    ORDER BY name
  `;
  for (const row of r) console.log(`${row.id}\t${row.dong}\t${row.name}`);
  await sql.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
