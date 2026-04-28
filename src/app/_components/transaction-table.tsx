"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { formatArea, formatDeposit } from "@/lib/format";
import type { FlatTxRow } from "@/lib/queries/expiring-leases";

export function TransactionTable({
  rows,
  total,
  page,
  pageSize,
  selectedAptId,
}: {
  rows: FlatTxRow[];
  total: number;
  page: number;
  pageSize: number;
  selectedAptId?: number;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  const openDetail = (aptId: number | null) => {
    if (!aptId) return;
    const sp = new URLSearchParams(searchParams);
    sp.set("apt", String(aptId));
    startTransition(() => router.push(`/?${sp.toString()}`));
  };

  if (rows.length === 0) {
    return (
      <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
        조건에 맞는 거래가 없어.
      </div>
    );
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="flex flex-col overflow-hidden">
      <div className="overflow-auto">
        <table className="w-full border-collapse text-sm">
          <thead className="sticky top-0 bg-muted text-xs">
            <tr className="border-b border-border">
              <Th>만료(추정)</Th>
              <Th>계약일</Th>
              <Th>단지</Th>
              <Th>동</Th>
              <Th align="right">평형</Th>
              <Th align="right">층</Th>
              <Th>유형</Th>
              <Th align="right">보증금</Th>
              <Th align="right">월세</Th>
              <Th>신규/갱신</Th>
              <Th>갱신권</Th>
              <Th align="right">준공</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const selected = selectedAptId === r.apartmentId;
              return (
                <tr
                  key={r.id}
                  onClick={() => openDetail(r.apartmentId)}
                  className={`cursor-pointer border-b border-border ${selected ? "bg-accent/60" : "hover:bg-accent/40"}`}
                >
                  <Td>{r.effectiveEnd}</Td>
                  <Td className="text-muted-foreground">{r.contractDate}</Td>
                  <Td className="font-medium">{r.apartmentName}</Td>
                  <Td>{r.dong}</Td>
                  <Td align="right" className="text-xs">{formatArea(r.exclusiveArea)}</Td>
                  <Td align="right">{r.floor ?? "-"}</Td>
                  <Td>
                    <span className={`rounded px-1.5 py-0.5 text-xs ${r.leaseType === "전세" ? "bg-blue-500/15 text-blue-700 dark:text-blue-300" : "bg-purple-500/15 text-purple-700 dark:text-purple-300"}`}>
                      {r.leaseType}
                    </span>
                  </Td>
                  <Td align="right">{formatDeposit(r.deposit)}</Td>
                  <Td align="right">{r.monthlyRent > 0 ? r.monthlyRent.toLocaleString() : "-"}</Td>
                  <Td>{r.contractType ?? "-"}</Td>
                  <Td>
                    {r.renewalRightUsed === true ? (
                      <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-xs text-amber-700 dark:text-amber-300">사용</span>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </Td>
                  <Td align="right" className="text-xs text-muted-foreground">{r.buildingYear ?? "-"}</Td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <Pagination total={total} page={page} totalPages={totalPages} />
    </div>
  );
}

function Pagination({ total, page, totalPages }: { total: number; page: number; totalPages: number }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  const go = (next: number) => {
    const sp = new URLSearchParams(searchParams);
    if (next <= 1) sp.delete("page");
    else sp.set("page", String(next));
    startTransition(() => router.push(`/?${sp.toString()}`));
  };

  return (
    <div className="flex shrink-0 items-center justify-between border-t border-border bg-background px-4 py-2 text-xs">
      <div className="text-muted-foreground">
        {total.toLocaleString()}건 중 {((page - 1) * 50 + 1).toLocaleString()}~
        {Math.min(page * 50, total).toLocaleString()}
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => go(page - 1)}
          disabled={page <= 1}
          className="rounded border border-border px-2 py-1 disabled:opacity-40 hover:bg-accent"
        >
          이전
        </button>
        <span className="font-medium">
          {page} / {totalPages}
        </span>
        <button
          type="button"
          onClick={() => go(page + 1)}
          disabled={page >= totalPages}
          className="rounded border border-border px-2 py-1 disabled:opacity-40 hover:bg-accent"
        >
          다음
        </button>
      </div>
    </div>
  );
}

function Th({ children, align }: { children: React.ReactNode; align?: "right" }) {
  return (
    <th className={`px-3 py-2 font-medium text-muted-foreground ${align === "right" ? "text-right" : "text-left"}`}>
      {children}
    </th>
  );
}

function Td({ children, align, className }: { children: React.ReactNode; align?: "right"; className?: string }) {
  return (
    <td className={`whitespace-nowrap px-3 py-2 ${align === "right" ? "text-right" : ""} ${className ?? ""}`}>
      {children}
    </td>
  );
}
