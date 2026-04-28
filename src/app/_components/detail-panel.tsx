import { formatArea, formatDeposit } from "@/lib/format";
import type { ApartmentDetail } from "@/lib/queries/expiring-leases";
import { CloseDetailButton } from "./close-detail-button";

export function DetailPanel({ data }: { data: ApartmentDetail | null }) {
  if (!data) {
    return (
      <aside className="flex flex-col border-l border-border bg-background">
        <div className="flex items-center justify-between border-b border-border px-4 py-2">
          <span className="text-xs text-muted-foreground">단지 상세</span>
          <CloseDetailButton />
        </div>
        <div className="flex flex-1 items-center justify-center p-4 text-sm text-muted-foreground">
          해당 단지를 찾을 수 없어.
        </div>
      </aside>
    );
  }

  const { name, dong, buildingYear, matchedTxns, totalFutureTxns, expiringTxns } = data;
  const renewals = expiringTxns.filter((t) => t.contractType === "갱신").length;
  const renewalRights = expiringTxns.filter((t) => t.renewalRightUsed === true).length;
  const jeonse = expiringTxns.filter((t) => t.leaseType === "전세").length;
  const filtered = matchedTxns < totalFutureTxns;

  return (
    <aside className="flex flex-col overflow-hidden border-l border-border bg-background">
      <div className="flex items-start justify-between gap-2 border-b border-border px-4 py-3">
        <div className="min-w-0">
          <h2 className="truncate text-base font-semibold">{name}</h2>
          <p className="text-xs text-muted-foreground">
            {dong} · 준공 {buildingYear ?? "?"} ·{" "}
            {filtered ? (
              <>
                <span className="font-medium text-foreground">{matchedTxns}</span>건 (필터 적용,
                전체 만료 미래 {totalFutureTxns}건)
              </>
            ) : (
              <>{totalFutureTxns}건 (만료 미래)</>
            )}
          </p>
        </div>
        <CloseDetailButton />
      </div>

      <div className="grid grid-cols-3 gap-2 border-b border-border bg-muted/30 px-4 py-2 text-center text-xs">
        <Stat label="전세" value={`${jeonse}건`} />
        <Stat label="갱신계약" value={`${renewals}건`} />
        <Stat label="갱신권 사용" value={`${renewalRights}건`} />
      </div>

      <div className="overflow-auto">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-muted">
            <tr className="border-b border-border">
              <th className="px-2 py-1.5 text-left font-medium text-muted-foreground">만료</th>
              <th className="px-2 py-1.5 text-left font-medium text-muted-foreground">계약일</th>
              <th className="px-2 py-1.5 text-right font-medium text-muted-foreground">평형</th>
              <th className="px-2 py-1.5 text-right font-medium text-muted-foreground">층</th>
              <th className="px-2 py-1.5 text-left font-medium text-muted-foreground">유형</th>
              <th className="px-2 py-1.5 text-right font-medium text-muted-foreground">보증금</th>
              <th className="px-2 py-1.5 text-right font-medium text-muted-foreground">월세</th>
              <th className="px-2 py-1.5 text-left font-medium text-muted-foreground">갱신</th>
            </tr>
          </thead>
          <tbody>
            {expiringTxns.map((t) => (
              <tr key={t.id} className="border-b border-border/60">
                <td className="px-2 py-1.5">{t.effectiveEnd}</td>
                  <td className="px-2 py-1.5 text-muted-foreground">{t.contractDate}</td>
                  <td className="px-2 py-1.5 text-right text-[11px]">{formatArea(t.exclusiveArea)}</td>
                  <td className="px-2 py-1.5 text-right">{t.floor ?? "-"}</td>
                  <td className="px-2 py-1.5">{t.leaseType}</td>
                  <td className="px-2 py-1.5 text-right font-medium">{formatDeposit(t.deposit)}</td>
                  <td className="px-2 py-1.5 text-right">{t.monthlyRent > 0 ? t.monthlyRent : "-"}</td>
                  <td className="px-2 py-1.5">
                    {t.contractType === "갱신" ? (
                      <span className="rounded bg-amber-500/15 px-1 py-0.5 text-amber-700 dark:text-amber-300">
                        갱신{t.renewalRightUsed ? "·권리" : ""}
                      </span>
                    ) : t.contractType === "신규" ? (
                      <span className="text-muted-foreground">신규</span>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </td>
                </tr>
            ))}
          </tbody>
        </table>
      </div>
    </aside>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-[10px] text-muted-foreground">{label}</span>
      <span className="font-semibold">{value}</span>
    </div>
  );
}
