import postgres from "postgres";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");

  const sql = postgres(url, { prepare: false, max: 1 });

  console.log("\n=== 1. 계약기간(contract_term_end) 채워진 비율 ===");
  const fillRate = await sql<{ total: bigint; with_end: bigint; renewal: bigint; renewal_used: bigint }[]>`
    SELECT
      COUNT(*)::bigint AS total,
      COUNT(contract_term_end)::bigint AS with_end,
      COUNT(*) FILTER (WHERE contract_type = '갱신')::bigint AS renewal,
      COUNT(*) FILTER (WHERE renewal_right_used = true)::bigint AS renewal_used
    FROM jungnang.transactions
  `;
  console.table(fillRate);

  console.log("\n=== 2. 만료 시점 분포 (contract_term_end 기준, 미래만) ===");
  const expiry = await sql<{ ym: string; count: bigint; renewal: bigint }[]>`
    SELECT
      TO_CHAR(contract_term_end, 'YYYY-MM') AS ym,
      COUNT(*)::bigint AS count,
      COUNT(*) FILTER (WHERE contract_type = '갱신')::bigint AS renewal
    FROM jungnang.transactions
    WHERE contract_term_end IS NOT NULL
      AND contract_term_end >= CURRENT_DATE
      AND contract_term_end < CURRENT_DATE + INTERVAL '24 months'
    GROUP BY 1 ORDER BY 1
  `;
  for (const r of expiry) console.log(`  ${r.ym}: ${r.count}건 (갱신 ${r.renewal}건)`);

  console.log("\n=== 3. 향후 3개월 안에 만료 — 단지별 Top 10 ===");
  const topApts = await sql<{ apartment_name: string; dong: string; expiring: bigint }[]>`
    SELECT apartment_name, dong, COUNT(*)::bigint AS expiring
    FROM jungnang.transactions
    WHERE contract_term_end BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '3 months'
    GROUP BY apartment_name, dong
    ORDER BY expiring DESC
    LIMIT 10
  `;
  console.table(topApts);

  console.log("\n=== 4. 계약일 기준 추정 만료 (term_end 없는 행 처리) ===");
  // 계약기간이 비어 있어도 계약일 + 2년으로 추정 만료 분포
  const estimated = await sql<{ window: string; count: bigint }[]>`
    SELECT
      CASE
        WHEN COALESCE(contract_term_end, contract_date + INTERVAL '2 years')::date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '3 months' THEN '0-3개월'
        WHEN COALESCE(contract_term_end, contract_date + INTERVAL '2 years')::date BETWEEN CURRENT_DATE + INTERVAL '3 months' AND CURRENT_DATE + INTERVAL '6 months' THEN '3-6개월'
        WHEN COALESCE(contract_term_end, contract_date + INTERVAL '2 years')::date BETWEEN CURRENT_DATE + INTERVAL '6 months' AND CURRENT_DATE + INTERVAL '12 months' THEN '6-12개월'
        WHEN COALESCE(contract_term_end, contract_date + INTERVAL '2 years')::date < CURRENT_DATE THEN '이미 만료'
        ELSE '12개월+'
      END AS window,
      COUNT(*)::bigint AS count
    FROM jungnang.transactions
    WHERE lease_type = '전세'
    GROUP BY 1 ORDER BY 1
  `;
  console.table(estimated);

  await sql.end();
}

main().catch((err) => {
  console.error("[inspect] failed:", err);
  process.exit(1);
});
