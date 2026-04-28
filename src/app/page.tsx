import { parseFilters, parseView, TX_PAGE_SIZE } from "@/lib/filter-params";
import {
  getApartmentDetail,
  listRegions,
  searchExpiring,
  searchTransactions,
  summarize,
} from "@/lib/queries/expiring-leases";
import { sigunguName } from "@/lib/sigungu";
import { DetailPanel } from "./_components/detail-panel";
import { FilterPanel } from "./_components/filter-panel";
import { MapView } from "./_components/map-view";
import { ResultsTable } from "./_components/results-table";
import { TransactionTable } from "./_components/transaction-table";
import { ViewToggle } from "./_components/view-toggle";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function Home({ searchParams }: PageProps) {
  const sp = await searchParams;
  const filters = parseFilters(sp);
  const viewState = parseView(sp);

  const [stats, regions] = await Promise.all([summarize(filters), listRegions()]);

  // 지도 모드도 단지 단위 데이터(좌표 포함) 사용
  const aptRows =
    viewState.view === "apt" || viewState.view === "map" ? await searchExpiring(filters) : [];
  const txData =
    viewState.view === "tx"
      ? await searchTransactions(filters, viewState.page, TX_PAGE_SIZE)
      : { rows: [], total: 0 };

  const detail = viewState.apt ? await getApartmentDetail(viewState.apt, filters) : null;
  const showDetail = !!viewState.apt;

  return (
    <div className="flex h-dvh flex-col">
      <header className="flex shrink-0 items-center justify-between border-b border-border bg-background px-4 py-3">
        <div>
          <h1 className="text-base font-semibold">전세 만료 트래커</h1>
          <p className="text-xs text-muted-foreground">
            {regionLabel(filters.sigunguCodes, regions.map((r) => r.sigunguCode))} · 계약 데이터 2024-01 ~ 2025-04
          </p>
        </div>
        <SummaryBadges stats={stats} label={periodLabel(filters)} />
      </header>

      <main
        className={`grid flex-1 overflow-hidden ${
          showDetail ? "grid-cols-[260px_minmax(0,1fr)_420px]" : "grid-cols-[260px_1fr]"
        }`}
      >
        <FilterPanel regions={regions} />
        <section className="flex flex-col overflow-hidden">
          <div className="flex shrink-0 items-center justify-between border-b border-border bg-background px-4 py-2 text-xs">
            <div className="text-muted-foreground">
              <strong className="text-foreground">{periodLabel(filters)}</strong> 만료 ·{" "}
              {viewState.view === "apt" || viewState.view === "map" ? (
                <>
                  <strong className="text-foreground">{aptRows.length}</strong>개 단지 ·{" "}
                </>
              ) : null}
              <strong className="text-foreground">{stats.totalTxns.toLocaleString()}</strong>건 ·{" "}
              갱신 비율 <strong className="text-foreground">{stats.renewalRate}%</strong>
            </div>
            <ViewToggle current={viewState.view} />
          </div>

          {viewState.view === "apt" && (
            <ResultsTable rows={aptRows} selectedAptId={viewState.apt} />
          )}
          {viewState.view === "tx" && (
            <TransactionTable
              rows={txData.rows}
              total={txData.total}
              page={viewState.page}
              pageSize={TX_PAGE_SIZE}
              selectedAptId={viewState.apt}
            />
          )}
          {viewState.view === "map" && (
            <MapView
              appKey={process.env.NEXT_PUBLIC_KAKAO_MAP_KEY}
              rows={aptRows}
              selectedAptId={viewState.apt}
            />
          )}
        </section>

        {showDetail && <DetailPanel data={detail} />}
      </main>
    </div>
  );
}

function SummaryBadges({
  stats,
  label,
}: {
  stats: { totalApts: number; totalTxns: number; renewalRate: number };
  label: string;
}) {
  return (
    <div className="flex items-center gap-3 text-xs">
      <Badge label={`${label} 만료`} value={`${stats.totalTxns.toLocaleString()}건`} />
      <Badge label="단지" value={`${stats.totalApts.toLocaleString()}개`} />
      <Badge label="갱신비율" value={`${stats.renewalRate}%`} />
    </div>
  );
}

function Badge({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col items-end gap-0.5 rounded border border-border bg-muted/40 px-2.5 py-1">
      <span className="text-[10px] uppercase text-muted-foreground">{label}</span>
      <span className="font-semibold">{value}</span>
    </div>
  );
}

function regionLabel(selected: string[] | undefined, available: string[]): string {
  if (!selected || selected.length === 0) {
    return available.length === 1
      ? sigunguName(available[0])
      : `전체 (${available.length}개 시군구)`;
  }
  return selected.map(sigunguName).join(", ");
}

function periodLabel(filters: { window: string; endFrom?: string; endTo?: string }): string {
  if (filters.endFrom && filters.endTo) {
    return filters.endFrom === filters.endTo
      ? filters.endFrom
      : `${filters.endFrom} ~ ${filters.endTo}`;
  }
  switch (filters.window) {
    case "1m": return "1개월";
    case "3m": return "3개월";
    case "6m": return "6개월";
    case "12m": return "12개월";
    case "all": return "전체";
    default: return "3개월";
  }
}
