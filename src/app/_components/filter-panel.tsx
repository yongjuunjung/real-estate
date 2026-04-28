"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { readPyeongRaw } from "@/lib/filter-params";
import { parseFilters } from "@/lib/filter-params";
import type { RegionOption } from "@/lib/queries/expiring-leases";
import { sigunguName } from "@/lib/sigungu";
import type { ExpiryWindow } from "@/lib/queries/expiring-leases";

const windowOptions: { value: ExpiryWindow; label: string }[] = [
  { value: "1m", label: "1개월" },
  { value: "3m", label: "3개월" },
  { value: "6m", label: "6개월" },
  { value: "12m", label: "12개월" },
  { value: "all", label: "전체" },
];

export function FilterPanel({ regions }: { regions: RegionOption[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);

  const sp: Record<string, string | string[] | undefined> = {};
  for (const [k, v] of searchParams.entries()) sp[k] = v;
  const filters = parseFilters(sp);
  const pyeong = readPyeongRaw(sp);

  const update = (mutate: (next: URLSearchParams) => void) => {
    const next = new URLSearchParams(searchParams);
    mutate(next);
    next.delete("page");
    startTransition(() => {
      router.push(next.toString() ? `/?${next}` : "/");
    });
  };

  const setSingle = (key: string, value: string | undefined) =>
    update((s) => {
      if (value === undefined || value === "") s.delete(key);
      else s.set(key, value);
    });

  const toggleList = (key: string, value: string) =>
    update((s) => {
      const cur = (s.get(key) ?? "").split(",").filter(Boolean);
      const idx = cur.indexOf(value);
      if (idx >= 0) cur.splice(idx, 1);
      else cur.push(value);
      if (cur.length > 0) s.set(key, cur.join(","));
      else s.delete(key);
    });

  const selectedSigungus = filters.sigunguCodes ?? [];
  const visibleDongs = (() => {
    if (selectedSigungus.length === 0) {
      return [...new Set(regions.flatMap((r) => r.dongs))].sort();
    }
    return [
      ...new Set(
        regions.filter((r) => selectedSigungus.includes(r.sigunguCode)).flatMap((r) => r.dongs),
      ),
    ].sort();
  })();

  return (
    <>
      {/* 모바일: 햄버거 버튼 (좌상단 고정) */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="필터 열기"
        className="fixed left-3 top-3 z-30 inline-flex h-9 items-center gap-1.5 rounded-full border border-border bg-background px-3 text-xs font-medium shadow-md md:hidden"
      >
        <span aria-hidden>☰</span> 필터
      </button>

      {/* 모바일: 드로어 backdrop */}
      {open && (
        <button
          type="button"
          aria-label="필터 닫기"
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-30 bg-black/40 md:hidden"
        />
      )}

      <aside
        className={`
          flex flex-col gap-5 overflow-y-auto bg-background p-4 text-sm
          fixed inset-y-0 left-0 z-40 w-[280px] max-w-[85vw] shadow-xl
          transition-transform duration-200
          ${open ? "translate-x-0" : "-translate-x-full"}
          md:static md:z-auto md:w-auto md:max-w-none md:translate-x-0 md:border-r md:border-border md:bg-muted/30 md:shadow-none md:transition-none
        `}
      >
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="필터 닫기"
          className="self-end rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground md:hidden"
        >
          ✕
        </button>

      <FilterGroup label="시군구">
        <div className="flex flex-wrap gap-1">
          {regions.length === 0 ? (
            <span className="text-xs text-muted-foreground">데이터 없음</span>
          ) : (
            regions.map((r) => {
              const active = selectedSigungus.includes(r.sigunguCode);
              return (
                <button
                  key={r.sigunguCode}
                  type="button"
                  onClick={() => {
                    update((s) => {
                      toggleListInUrl(s, "gu", r.sigunguCode);
                      s.delete("dong"); // 시군구 바꾸면 동 필터 초기화
                    });
                  }}
                  className={chipClass(active)}
                  title={`${r.txCount.toLocaleString()}건`}
                >
                  {sigunguName(r.sigunguCode)}
                </button>
              );
            })
          )}
        </div>
      </FilterGroup>

      <FilterGroup label="만료 시점 (지금부터)">
        <div className="flex flex-wrap gap-1">
          {windowOptions.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() =>
                update((s) => {
                  if (opt.value === "3m") s.delete("window");
                  else s.set("window", opt.value);
                  s.delete("efrom");
                  s.delete("eto");
                })
              }
              className={chipClass(
                !filters.endFrom && !filters.endTo && filters.window === opt.value,
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <p className="text-[10px] text-muted-foreground">아래 월 범위가 있으면 이 칩 무시됨</p>
      </FilterGroup>

      <FilterGroup label="만료 월 범위 (특정 시점)">
        <div className="flex items-center gap-1">
          <input
            type="month"
            defaultValue={filters.endFrom ?? ""}
            onBlur={(e) => setSingle("efrom", e.target.value || undefined)}
            className="rounded border border-border bg-background px-2 py-1 text-xs"
          />
          <span className="text-muted-foreground">~</span>
          <input
            type="month"
            defaultValue={filters.endTo ?? ""}
            onBlur={(e) => setSingle("eto", e.target.value || undefined)}
            className="rounded border border-border bg-background px-2 py-1 text-xs"
          />
        </div>
        {(filters.endFrom || filters.endTo) && (
          <button
            type="button"
            onClick={() =>
              update((s) => {
                s.delete("efrom");
                s.delete("eto");
              })
            }
            className="self-start text-[10px] text-muted-foreground underline"
          >
            월 범위 해제
          </button>
        )}
      </FilterGroup>

      <FilterGroup label="법정동">
        {visibleDongs.length === 0 ? (
          <span className="text-xs text-muted-foreground">데이터 없음</span>
        ) : (
          <div className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1">
            {visibleDongs.map((dong) => (
              <button
                key={dong}
                type="button"
                onClick={() => toggleList("dong", dong)}
                className={`${chipClass(filters.dongs?.includes(dong) ?? false)} shrink-0 whitespace-nowrap`}
              >
                {dong}
              </button>
            ))}
          </div>
        )}
      </FilterGroup>

      <FilterGroup label="유형">
        <div className="flex gap-1">
          {(["all", "전세", "월세"] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setSingle("lease", v === "all" ? undefined : v)}
              className={chipClass(filters.leaseType === v)}
            >
              {v === "all" ? "전체" : v}
            </button>
          ))}
        </div>
      </FilterGroup>

      <FilterGroup label="신규/갱신">
        <div className="flex gap-1">
          {(["all", "신규", "갱신"] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setSingle("ctype", v === "all" ? undefined : v)}
              className={chipClass(filters.contractType === v)}
            >
              {v === "all" ? "전체" : v}
            </button>
          ))}
        </div>
      </FilterGroup>

      <FilterGroup label="갱신권 사용">
        <div className="flex gap-1">
          {(["all", "yes", "no"] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setSingle("renewal", v === "all" ? undefined : v)}
              className={chipClass(filters.renewalRightUsed === v)}
            >
              {v === "all" ? "전체" : v === "yes" ? "사용" : "미사용"}
            </button>
          ))}
        </div>
      </FilterGroup>

      <FilterGroup label="보증금 (만원)">
        <div className="flex items-center gap-1">
          <RangeInput
            value={filters.depositMin}
            placeholder="최소"
            onCommit={(n) => setSingle("dmin", n === undefined ? undefined : String(n))}
          />
          <span className="text-muted-foreground">~</span>
          <RangeInput
            value={filters.depositMax}
            placeholder="최대"
            onCommit={(n) => setSingle("dmax", n === undefined ? undefined : String(n))}
          />
        </div>
      </FilterGroup>

      <FilterGroup label="평형 (평)">
        <div className="flex items-center gap-1">
          <RangeInput
            value={pyeong.pmin}
            placeholder="예: 25"
            onCommit={(n) => setSingle("pmin", n === undefined ? undefined : String(n))}
          />
          <span className="text-muted-foreground">~</span>
          <RangeInput
            value={pyeong.pmax}
            placeholder="예: 33"
            onCommit={(n) => setSingle("pmax", n === undefined ? undefined : String(n))}
          />
        </div>
        <p className="text-[10px] text-muted-foreground">1평 ≈ 3.3058㎡</p>
      </FilterGroup>

      <button
        type="button"
        onClick={() => startTransition(() => router.push("/"))}
        className="mt-auto rounded border border-border bg-background px-3 py-1.5 text-xs hover:bg-accent"
      >
        필터 초기화
      </button>

      {isPending && <div className="text-xs text-muted-foreground">불러오는 중…</div>}
      </aside>
    </>
  );
}

function toggleListInUrl(sp: URLSearchParams, key: string, value: string) {
  const cur = (sp.get(key) ?? "").split(",").filter(Boolean);
  const idx = cur.indexOf(value);
  if (idx >= 0) cur.splice(idx, 1);
  else cur.push(value);
  if (cur.length > 0) sp.set(key, cur.join(","));
  else sp.delete(key);
}

function FilterGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      {children}
    </div>
  );
}

function RangeInput({
  value,
  placeholder,
  onCommit,
}: {
  value: number | undefined;
  placeholder: string;
  onCommit: (v: number | undefined) => void;
}) {
  return (
    <input
      type="number"
      inputMode="numeric"
      defaultValue={value ?? ""}
      placeholder={placeholder}
      onBlur={(e) => {
        const v = e.target.value;
        const n = v === "" ? undefined : Number(v);
        onCommit(Number.isFinite(n) ? (n as number) : undefined);
      }}
      className="w-20 rounded border border-border bg-background px-2 py-1 text-xs"
    />
  );
}

function chipClass(active: boolean): string {
  const base = "rounded border px-2 py-1 text-xs transition";
  return active
    ? `${base} border-foreground bg-foreground text-background`
    : `${base} border-border bg-background hover:bg-accent`;
}
