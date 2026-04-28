"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { formatDeposit } from "@/lib/format";
import type { ApartmentExpiryRow } from "@/lib/queries/expiring-leases";

export function ResultsTable({ rows, selectedAptId }: { rows: ApartmentExpiryRow[]; selectedAptId?: number }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  const openDetail = (aptId: number) => {
    const sp = new URLSearchParams(searchParams);
    sp.set("apt", String(aptId));
    sp.delete("page");
    startTransition(() => {
      router.push(`/?${sp.toString()}`);
    });
  };

  if (rows.length === 0) {
    return (
      <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
        조건에 맞는 매물이 없어. 필터를 풀어볼래?
      </div>
    );
  }

  return (
    <div className="overflow-auto">
      <table className="w-full border-collapse text-sm">
        <thead className="sticky top-0 bg-muted text-xs">
          <tr className="border-b border-border">
            <Th>단지</Th>
            <Th>동</Th>
            <Th align="right">만료 임박</Th>
            <Th align="right">갱신</Th>
            <Th>최단 만료</Th>
            <Th>최장 만료</Th>
            <Th align="right">평균 보증금</Th>
            <Th align="right">최저~최고</Th>
            <Th align="right">준공</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const selected = selectedAptId === r.apartmentId;
            return (
              <tr
                key={`${r.apartmentId}-${r.apartmentName}`}
                onClick={() => openDetail(r.apartmentId)}
                className={`cursor-pointer border-b border-border ${selected ? "bg-accent/60" : "hover:bg-accent/40"}`}
              >
                <Td className="font-medium">{r.apartmentName}</Td>
                <Td>{r.dong}</Td>
                <Td align="right" className="font-semibold">{r.expiringCount}</Td>
                <Td align="right">
                  {r.renewalCount > 0 ? (
                    <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-amber-700 dark:text-amber-300">
                      {r.renewalCount}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </Td>
                <Td>{r.earliestEnd ?? "-"}</Td>
                <Td>{r.latestEnd ?? "-"}</Td>
                <Td align="right">{formatDeposit(r.avgDeposit)}</Td>
                <Td align="right" className="text-xs text-muted-foreground">
                  {formatDeposit(r.minDeposit)} ~ {formatDeposit(r.maxDeposit)}
                </Td>
                <Td align="right" className="text-xs text-muted-foreground">{r.buildingYear ?? "-"}</Td>
              </tr>
            );
          })}
        </tbody>
      </table>
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
    <td className={`px-3 py-2 ${align === "right" ? "text-right" : ""} ${className ?? ""}`}>
      {children}
    </td>
  );
}

