import { and, asc, between, desc, eq, gte, inArray, lte, or, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { apartments, transactions } from "@/db/schema";

export type ExpiryWindow = "1m" | "3m" | "6m" | "12m" | "all";

export interface ExpiringFilters {
  window: ExpiryWindow;
  /** 'YYYY-MM' — 두 값이 모두 있으면 window를 대체. 만료(추정)일이 [endFrom 1일, endTo 말일] 안에 들어오는 거래만 집계. */
  endFrom?: string;
  endTo?: string;
  /** 시군구 코드 (예: ["11260"]). 비어 있으면 모든 지역. */
  sigunguCodes?: string[];
  dongs?: string[];
  leaseType?: "전세" | "월세" | "all";
  contractType?: "신규" | "갱신" | "all";
  renewalRightUsed?: "yes" | "no" | "all";
  depositMin?: number;
  depositMax?: number;
  /** 전용면적 ㎡ 단위 (UI에서 평 입력 → ㎡로 변환되어 들어옴) */
  areaMin?: number;
  areaMax?: number;
}

export interface ApartmentExpiryRow {
  apartmentId: number;
  apartmentName: string;
  dong: string;
  buildingYear: number | null;
  lat: string | null;
  lon: string | null;
  expiringCount: number;
  renewalCount: number;
  earliestEnd: string | null;
  latestEnd: string | null;
  avgDeposit: number;
  minDeposit: number;
  maxDeposit: number;
}

export interface ApartmentTransactionRow {
  id: number;
  contractDate: string;
  effectiveEnd: string;
  exclusiveArea: string;
  floor: number | null;
  leaseType: string;
  deposit: number;
  monthlyRent: number;
  contractType: string | null;
  renewalRightUsed: boolean | null;
}

const windowToMonths = (w: ExpiryWindow): number => {
  switch (w) {
    case "1m": return 1;
    case "3m": return 3;
    case "6m": return 6;
    case "12m": return 12;
    case "all": return 240;
  }
};

// 한국 전세 표준 계약기간 2년 가정. 시작일 + 2년 - 1일 = 만료일.
// (예: 2024-09-27 시작 → 2026-09-26 만료)
// 정부 데이터의 contract_term_end는 월 단위로 절삭돼 있어 부정확하므로 사용하지 않는다.
const effectiveEnd = sql<string>`(${transactions.contractDate} + INTERVAL '2 years' - INTERVAL '1 day')::date`;

function buildWhere(filters: ExpiringFilters) {
  const conds = [];

  if (filters.endFrom && filters.endTo) {
    // 명시적 월 범위가 있으면 window 무시. endTo의 다음 달 1일 미만으로 잡아 말일 포함.
    const fromDate = `${filters.endFrom}-01`;
    const [y, m] = filters.endTo.split("-").map(Number);
    const next = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, "0")}-01`;
    conds.push(sql`${effectiveEnd} >= ${fromDate}::date`);
    conds.push(sql`${effectiveEnd} < ${next}::date`);
  } else {
    const months = windowToMonths(filters.window);
    conds.push(sql`${effectiveEnd} >= CURRENT_DATE`);
    conds.push(sql`${effectiveEnd} < CURRENT_DATE + (${months} * INTERVAL '1 month')`);
  }

  if (filters.sigunguCodes && filters.sigunguCodes.length > 0) {
    conds.push(inArray(transactions.sigunguCode, filters.sigunguCodes));
  }
  if (filters.dongs && filters.dongs.length > 0) {
    conds.push(inArray(transactions.dong, filters.dongs));
  }
  if (filters.leaseType && filters.leaseType !== "all") {
    conds.push(eq(transactions.leaseType, filters.leaseType));
  }
  if (filters.contractType && filters.contractType !== "all") {
    conds.push(eq(transactions.contractType, filters.contractType));
  }
  if (filters.renewalRightUsed === "yes") {
    conds.push(eq(transactions.renewalRightUsed, true));
  } else if (filters.renewalRightUsed === "no") {
    conds.push(or(eq(transactions.renewalRightUsed, false), sql`${transactions.renewalRightUsed} IS NULL`)!);
  }
  if (typeof filters.depositMin === "number") {
    conds.push(gte(transactions.deposit, filters.depositMin));
  }
  if (typeof filters.depositMax === "number") {
    conds.push(lte(transactions.deposit, filters.depositMax));
  }
  if (typeof filters.areaMin === "number") {
    conds.push(sql`${transactions.exclusiveArea} >= ${filters.areaMin}`);
  }
  if (typeof filters.areaMax === "number") {
    conds.push(sql`${transactions.exclusiveArea} <= ${filters.areaMax}`);
  }

  return and(...conds);
}

export interface FlatTxRow {
  id: number;
  apartmentId: number | null;
  apartmentName: string;
  dong: string;
  contractDate: string;
  effectiveEnd: string;
  contractTermEndRaw: string | null;
  exclusiveArea: string;
  floor: number | null;
  leaseType: string;
  deposit: number;
  monthlyRent: number;
  contractType: string | null;
  renewalRightUsed: boolean | null;
  buildingYear: number | null;
}

export async function searchTransactions(
  filters: ExpiringFilters,
  page: number,
  pageSize: number,
): Promise<{ rows: FlatTxRow[]; total: number }> {
  const db = getDb();
  const where = buildWhere(filters);

  const [{ total }] = await db
    .select({ total: sql<number>`COUNT(*)::int` })
    .from(transactions)
    .where(where);

  const rows = await db
    .select({
      id: transactions.id,
      apartmentId: transactions.apartmentId,
      apartmentName: transactions.apartmentName,
      dong: transactions.dong,
      contractDate: sql<string>`${transactions.contractDate}::text`,
      effectiveEnd: sql<string>`${effectiveEnd}::text`,
      contractTermEndRaw: sql<string | null>`${transactions.contractTermEnd}::text`,
      exclusiveArea: transactions.exclusiveArea,
      floor: transactions.floor,
      leaseType: transactions.leaseType,
      deposit: transactions.deposit,
      monthlyRent: transactions.monthlyRent,
      contractType: transactions.contractType,
      renewalRightUsed: transactions.renewalRightUsed,
      buildingYear: apartments.buildingYear,
    })
    .from(transactions)
    .leftJoin(apartments, eq(apartments.id, transactions.apartmentId))
    .where(where)
    .orderBy(asc(effectiveEnd), asc(transactions.apartmentName))
    .limit(pageSize)
    .offset((page - 1) * pageSize);

  return { rows, total };
}

export interface ApartmentDetail {
  id: number;
  name: string;
  dong: string;
  buildingYear: number | null;
  /** 현재 필터 + 미래 만료 조건에 매칭된 거래 수 */
  matchedTxns: number;
  /** 단지의 미래 만료 거래 전체 수 (필터 무시) — "전체 N건 중 M건 매칭" 표시용 */
  totalFutureTxns: number;
  expiringTxns: FlatTxRow[];
}

export async function getApartmentDetail(
  apartmentId: number,
  filters: ExpiringFilters,
): Promise<ApartmentDetail | null> {
  const db = getDb();
  const [apt] = await db
    .select({
      id: apartments.id,
      name: apartments.name,
      dong: apartments.dong,
      buildingYear: apartments.buildingYear,
    })
    .from(apartments)
    .where(eq(apartments.id, apartmentId))
    .limit(1);
  if (!apt) return null;

  const filterWhere = buildWhere(filters);
  const txs = await db
    .select({
      id: transactions.id,
      apartmentId: transactions.apartmentId,
      apartmentName: transactions.apartmentName,
      dong: transactions.dong,
      contractDate: sql<string>`${transactions.contractDate}::text`,
      effectiveEnd: sql<string>`${effectiveEnd}::text`,
      contractTermEndRaw: sql<string | null>`${transactions.contractTermEnd}::text`,
      exclusiveArea: transactions.exclusiveArea,
      floor: transactions.floor,
      leaseType: transactions.leaseType,
      deposit: transactions.deposit,
      monthlyRent: transactions.monthlyRent,
      contractType: transactions.contractType,
      renewalRightUsed: transactions.renewalRightUsed,
      buildingYear: sql<number | null>`${apartments.buildingYear}`,
    })
    .from(transactions)
    .leftJoin(apartments, eq(apartments.id, transactions.apartmentId))
    .where(and(eq(transactions.apartmentId, apartmentId), filterWhere))
    .orderBy(asc(effectiveEnd));

  const [{ totalFutureTxns }] = await db
    .select({
      totalFutureTxns: sql<number>`COUNT(*)::int`,
    })
    .from(transactions)
    .where(and(eq(transactions.apartmentId, apartmentId), sql`${effectiveEnd} >= CURRENT_DATE`));

  return {
    ...apt,
    matchedTxns: txs.length,
    totalFutureTxns,
    expiringTxns: txs,
  };
}

export interface RegionOption {
  sigunguCode: string;
  dongs: string[];
  txCount: number;
}

/** DB에 실제로 적재된 지역(시군구) 목록과 각 시군구의 동 목록. 필터 패널 채우기용. */
export async function listRegions(): Promise<RegionOption[]> {
  const db = getDb();
  const rows = await db
    .select({
      sigunguCode: transactions.sigunguCode,
      dong: transactions.dong,
      cnt: sql<number>`COUNT(*)::int`,
    })
    .from(transactions)
    .groupBy(transactions.sigunguCode, transactions.dong);

  const map = new Map<string, RegionOption>();
  for (const r of rows) {
    let entry = map.get(r.sigunguCode);
    if (!entry) {
      entry = { sigunguCode: r.sigunguCode, dongs: [], txCount: 0 };
      map.set(r.sigunguCode, entry);
    }
    entry.dongs.push(r.dong);
    entry.txCount += Number(r.cnt);
  }
  for (const v of map.values()) v.dongs.sort();
  return [...map.values()].sort((a, b) => a.sigunguCode.localeCompare(b.sigunguCode));
}

export async function searchExpiring(filters: ExpiringFilters): Promise<ApartmentExpiryRow[]> {
  const db = getDb();
  const where = buildWhere(filters);

  const rows = await db
    .select({
      apartmentId: transactions.apartmentId,
      apartmentName: transactions.apartmentName,
      dong: transactions.dong,
      buildingYear: apartments.buildingYear,
      lat: sql<string | null>`${apartments.lat}::text`,
      lon: sql<string | null>`${apartments.lon}::text`,
      expiringCount: sql<number>`COUNT(*)::int`,
      renewalCount: sql<number>`COUNT(*) FILTER (WHERE ${transactions.contractType} = '갱신')::int`,
      earliestEnd: sql<string>`MIN(${effectiveEnd})::text`,
      latestEnd: sql<string>`MAX(${effectiveEnd})::text`,
      avgDeposit: sql<number>`ROUND(AVG(${transactions.deposit}))::int`,
      minDeposit: sql<number>`MIN(${transactions.deposit})::int`,
      maxDeposit: sql<number>`MAX(${transactions.deposit})::int`,
    })
    .from(transactions)
    .leftJoin(apartments, eq(apartments.id, transactions.apartmentId))
    .where(where)
    .groupBy(transactions.apartmentId, transactions.apartmentName, transactions.dong, apartments.buildingYear, apartments.lat, apartments.lon)
    .orderBy(desc(sql`COUNT(*)`), asc(sql`MIN(${effectiveEnd})`));

  return rows.map((r) => ({
    ...r,
    apartmentId: r.apartmentId ?? 0,
  }));
}

export async function summarize(filters: ExpiringFilters): Promise<{ totalApts: number; totalTxns: number; renewalRate: number }> {
  const db = getDb();
  const where = buildWhere(filters);

  const [row] = await db
    .select({
      totalApts: sql<number>`COUNT(DISTINCT ${transactions.apartmentId})::int`,
      totalTxns: sql<number>`COUNT(*)::int`,
      renewalRate: sql<number>`ROUND(100.0 * COUNT(*) FILTER (WHERE ${transactions.contractType} = '갱신') / NULLIF(COUNT(*), 0), 1)::float`,
    })
    .from(transactions)
    .where(where);

  return {
    totalApts: row?.totalApts ?? 0,
    totalTxns: row?.totalTxns ?? 0,
    renewalRate: row?.renewalRate ?? 0,
  };
}

export async function getApartmentTransactions(
  apartmentId: number,
  filters: Omit<ExpiringFilters, "dongs" | "leaseType"> = { window: "all" },
): Promise<ApartmentTransactionRow[]> {
  const db = getDb();
  const where = and(
    eq(transactions.apartmentId, apartmentId),
    sql`${effectiveEnd} >= CURRENT_DATE`,
    sql`${effectiveEnd} < CURRENT_DATE + (${windowToMonths(filters.window)} * INTERVAL '1 month')`,
  );

  return db
    .select({
      id: transactions.id,
      contractDate: sql<string>`${transactions.contractDate}::text`,
      effectiveEnd: sql<string>`${effectiveEnd}::text`,
      exclusiveArea: transactions.exclusiveArea,
      floor: transactions.floor,
      leaseType: transactions.leaseType,
      deposit: transactions.deposit,
      monthlyRent: transactions.monthlyRent,
      contractType: transactions.contractType,
      renewalRightUsed: transactions.renewalRightUsed,
    })
    .from(transactions)
    .where(where)
    .orderBy(asc(effectiveEnd));
}
