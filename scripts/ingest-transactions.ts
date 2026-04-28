import { sql } from "drizzle-orm";
import { getDb } from "@/db";
import { apartments, transactions } from "@/db/schema";
import { JUNGNANG_SIGUNGU_CODE } from "@/lib/constants";
import { fetchAllAptRent } from "@/lib/public-data";
import { transformAptRent } from "@/lib/transform";

const APARTMENT_CHUNK = 500;
const TRANSACTION_CHUNK = 500;
const aptKeyOf = (k: { dong: string; jibun: string | null; name: string }) =>
  `${k.dong}|${k.jibun ?? "-"}|${k.name}`;

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

interface RunOptions {
  /** 적재할 시군구 코드 (default: 11260 중랑구) */
  lawdCode: string;
  /** 적재할 월 목록 ["202404", "202403", ...] */
  yearMonths: string[];
}

function defaultMonthsBack(months: number): string[] {
  const out: string[] = [];
  const now = new Date();
  for (let i = 0; i < months; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    out.push(`${y}${m}`);
  }
  return out;
}

function monthsBetween(fromYm: string, toYm: string): string[] {
  const parse = (s: string) => ({ y: Number(s.slice(0, 4)), m: Number(s.slice(4, 6)) });
  const a = parse(fromYm);
  const b = parse(toYm);
  const out: string[] = [];
  let y = a.y;
  let m = a.m;
  while (y < b.y || (y === b.y && m <= b.m)) {
    out.push(`${y}${String(m).padStart(2, "0")}`);
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  return out;
}

function parseCli(argv: string[]): { from?: string; to?: string; lawd?: string } {
  const args: Record<string, string> = {};
  for (const a of argv.slice(2)) {
    const m = a.match(/^--([^=]+)=(.+)$/);
    if (m) args[m[1]] = m[2];
  }
  return { from: args.from, to: args.to, lawd: args.lawd };
}

async function ingestMonth(db: ReturnType<typeof getDb>, lawdCode: string, ym: string) {
  console.log(`[ingest] ${lawdCode} ${ym} fetching...`);
  const items = await fetchAllAptRent({ lawdCode, dealYearMonth: ym });
  console.log(`[ingest] ${lawdCode} ${ym} got ${items.length} items`);

  // 1. transform 단계 — 유효 레코드만 추리고 단지 키별로 그룹핑
  const transformed = items
    .map((item) => transformAptRent(item))
    .filter((t): t is NonNullable<typeof t> => t !== null);
  const skipped = items.length - transformed.length;

  if (transformed.length === 0) {
    console.log(`[ingest] ${lawdCode} ${ym} inserted=0 skipped=${skipped}`);
    return;
  }

  // 2. 단지 단위로 distinct, bulk upsert + RETURNING
  type AptKey = { dong: string; jibun: string | null; name: string };
  const aptByKey = new Map<string, { key: AptKey; sigunguCode: string; buildingYear: number | null }>();
  for (const t of transformed) {
    const k = aptKeyOf(t.apartmentKey);
    if (!aptByKey.has(k)) {
      aptByKey.set(k, {
        key: t.apartmentKey,
        sigunguCode: t.row.sigunguCode,
        buildingYear: t.row.buildingYear ?? null,
      });
    }
  }

  const idByKey = new Map<string, number>();
  for (const group of chunk([...aptByKey.values()], APARTMENT_CHUNK)) {
    const rows = group.map((g) => ({
      sigunguCode: g.sigunguCode,
      dong: g.key.dong,
      jibun: g.key.jibun,
      name: g.key.name,
      buildingYear: g.buildingYear,
    }));
    const result = await db
      .insert(apartments)
      .values(rows)
      .onConflictDoUpdate({
        target: [apartments.dong, apartments.jibun, apartments.name],
        set: {
          updatedAt: new Date(),
          buildingYear: sql`COALESCE(EXCLUDED.building_year, ${apartments.buildingYear})`,
        },
      })
      .returning({
        id: apartments.id,
        dong: apartments.dong,
        jibun: apartments.jibun,
        name: apartments.name,
      });
    for (const r of result) idByKey.set(aptKeyOf(r), r.id);
  }

  // 3. 거래 bulk insert (sourceKey 충돌 시 무시)
  let inserted = 0;
  const txnRows = transformed.map((t) => ({
    ...t.row,
    apartmentId: idByKey.get(aptKeyOf(t.apartmentKey))!,
  }));
  for (const group of chunk(txnRows, TRANSACTION_CHUNK)) {
    const result = await db
      .insert(transactions)
      .values(group)
      .onConflictDoNothing({ target: transactions.sourceKey })
      .returning({ id: transactions.id });
    inserted += result.length;
  }

  console.log(`[ingest] ${lawdCode} ${ym} inserted=${inserted} skipped=${skipped}`);
}

export async function run(opts: Partial<RunOptions> = {}) {
  const lawdCode = opts.lawdCode ?? JUNGNANG_SIGUNGU_CODE;
  const yearMonths = opts.yearMonths ?? defaultMonthsBack(24);

  const db = getDb();

  await db.execute(sql`SELECT 1`);

  for (const ym of yearMonths) {
    await ingestMonth(db, lawdCode, ym);
  }
}

if (require.main === module) {
  const cli = parseCli(process.argv);
  const opts: Partial<RunOptions> = {};
  if (cli.lawd) opts.lawdCode = cli.lawd;
  if (cli.from && cli.to) opts.yearMonths = monthsBetween(cli.from, cli.to);

  run(opts)
    .then(() => {
      console.log("[ingest] done");
      process.exit(0);
    })
    .catch((err) => {
      console.error("[ingest] failed:", err);
      process.exit(1);
    });
}
