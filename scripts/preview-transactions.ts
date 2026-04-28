import { JUNGNANG_SIGUNGU_CODE } from "@/lib/constants";
import { fetchAllAptRent } from "@/lib/public-data";
import { transformAptRent } from "@/lib/transform";

interface CliArgs {
  lawdCode: string;
  yearMonth: string;
  limit: number;
  raw: boolean;
}

function parseArgs(argv: string[]): CliArgs {
  const args: Record<string, string | boolean> = {};
  for (const a of argv.slice(2)) {
    const m = a.match(/^--([^=]+)(?:=(.*))?$/);
    if (!m) continue;
    args[m[1]] = m[2] ?? true;
  }

  const now = new Date();
  const fallback = new Date(now.getFullYear(), now.getMonth() - 2, 1);
  const fallbackYm = `${fallback.getFullYear()}${String(fallback.getMonth() + 1).padStart(2, "0")}`;

  return {
    lawdCode: typeof args.lawd === "string" ? args.lawd : JUNGNANG_SIGUNGU_CODE,
    yearMonth: typeof args.month === "string" ? args.month : fallbackYm,
    limit: typeof args.limit === "string" ? Number(args.limit) : 20,
    raw: args.raw === true,
  };
}

async function main() {
  const { lawdCode, yearMonth, limit, raw } = parseArgs(process.argv);

  console.log(`[preview] LAWD=${lawdCode} YM=${yearMonth} limit=${limit} raw=${raw}`);
  const items = await fetchAllAptRent({ lawdCode, dealYearMonth: yearMonth });
  console.log(`[preview] fetched ${items.length} items`);

  const slice = items.slice(0, limit);

  if (raw) {
    console.table(slice);
    return;
  }

  const rows = slice
    .map((item) => transformAptRent(item))
    .filter((t): t is NonNullable<typeof t> => t !== null)
    .map(({ row }) => ({
      계약일: row.contractDate,
      동: row.dong,
      단지: row.apartmentName,
      평형: row.exclusiveArea,
      층: row.floor ?? "-",
      유형: row.leaseType,
      보증금만원: row.deposit,
      월세만원: row.monthlyRent,
      준공: row.buildingYear ?? "-",
      계약시작: row.contractTermStart ?? "-",
      계약종료: row.contractTermEnd ?? "-",
      신규갱신: row.contractType ?? "-",
      갱신권사용: row.renewalRightUsed === null ? "-" : row.renewalRightUsed ? "Y" : "N",
    }));

  console.table(rows);
  console.log(`[preview] showed ${rows.length} of ${items.length} (use --limit=N to change, --raw for raw fields)`);
}

main().catch((err) => {
  console.error("[preview] failed:", err);
  process.exit(1);
});
