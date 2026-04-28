import { pyeongToM2 } from "./format";
import type { ExpiringFilters, ExpiryWindow } from "./queries/expiring-leases";

const windows: ExpiryWindow[] = ["1m", "3m", "6m", "12m", "all"];

export type ViewMode = "apt" | "tx" | "map";

export interface ViewState {
  view: ViewMode;
  apt?: number;
  page: number;
}

export const TX_PAGE_SIZE = 50;

const num = (v: string | undefined): number | undefined => {
  if (!v) return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
};

export function parseFilters(sp: Record<string, string | string[] | undefined>): ExpiringFilters {
  const single = (k: string) => {
    const v = sp[k];
    return Array.isArray(v) ? v[0] : v;
  };
  const multi = (k: string): string[] => {
    const v = sp[k];
    if (Array.isArray(v)) return v;
    if (typeof v === "string" && v) return v.split(",").filter(Boolean);
    return [];
  };

  const w = single("window");
  const window: ExpiryWindow = (windows as string[]).includes(w ?? "") ? (w as ExpiryWindow) : "3m";

  const lt = single("lease");
  const ct = single("ctype");
  const rr = single("renewal");
  const ymRe = /^\d{4}-\d{2}$/;
  const endFrom = single("efrom");
  const endTo = single("eto");

  // 평 단위 입력을 ㎡로 변환. UI는 평으로 입력받고 query는 ㎡로 비교.
  const pyMin = num(single("pmin"));
  const pyMax = num(single("pmax"));

  return {
    window,
    endFrom: endFrom && ymRe.test(endFrom) ? endFrom : undefined,
    endTo: endTo && ymRe.test(endTo) ? endTo : undefined,
    sigunguCodes: multi("gu"),
    dongs: multi("dong"),
    leaseType: lt === "전세" || lt === "월세" ? lt : "all",
    contractType: ct === "신규" || ct === "갱신" ? ct : "all",
    renewalRightUsed: rr === "yes" || rr === "no" ? rr : "all",
    depositMin: num(single("dmin")),
    depositMax: num(single("dmax")),
    areaMin: typeof pyMin === "number" ? pyeongToM2(pyMin) : undefined,
    areaMax: typeof pyMax === "number" ? pyeongToM2(pyMax) : undefined,
  };
}

/** UI가 다시 보여줘야 할 원본(평) 값. parseFilters는 ㎡로 정규화하기 때문에 입력 칸 채우기용으로 별도 추출. */
export function readPyeongRaw(sp: Record<string, string | string[] | undefined>): {
  pmin?: number;
  pmax?: number;
} {
  const v = (k: string) => {
    const x = sp[k];
    return Array.isArray(x) ? x[0] : x;
  };
  const toNum = (s: string | undefined) => {
    if (!s) return undefined;
    const n = Number(s);
    return Number.isFinite(n) ? n : undefined;
  };
  return { pmin: toNum(v("pmin")), pmax: toNum(v("pmax")) };
}

export function parseView(sp: Record<string, string | string[] | undefined>): ViewState {
  const get = (k: string) => {
    const v = sp[k];
    return Array.isArray(v) ? v[0] : v;
  };
  const rawView = get("view");
  const view: ViewMode = rawView === "tx" ? "tx" : rawView === "map" ? "map" : "apt";
  const aptRaw = get("apt");
  const aptNum = aptRaw ? Number(aptRaw) : NaN;
  const apt = Number.isFinite(aptNum) && aptNum > 0 ? aptNum : undefined;
  const pageRaw = get("page");
  const pageNum = pageRaw ? Number(pageRaw) : 1;
  const page = Number.isFinite(pageNum) && pageNum >= 1 ? Math.trunc(pageNum) : 1;
  return { view, apt, page };
}

export function serializeAll(f: ExpiringFilters, v: ViewState): URLSearchParams {
  const sp = serializeFilters(f);
  if (v.view === "tx" || v.view === "map") sp.set("view", v.view);
  if (v.apt) sp.set("apt", String(v.apt));
  if (v.page > 1) sp.set("page", String(v.page));
  return sp;
}

export function serializeFilters(f: ExpiringFilters): URLSearchParams {
  const sp = new URLSearchParams();
  if (f.window !== "3m") sp.set("window", f.window);
  if (f.endFrom) sp.set("efrom", f.endFrom);
  if (f.endTo) sp.set("eto", f.endTo);
  if (f.sigunguCodes && f.sigunguCodes.length > 0) sp.set("gu", f.sigunguCodes.join(","));
  if (f.dongs && f.dongs.length > 0) sp.set("dong", f.dongs.join(","));
  if (f.leaseType && f.leaseType !== "all") sp.set("lease", f.leaseType);
  if (f.contractType && f.contractType !== "all") sp.set("ctype", f.contractType);
  if (f.renewalRightUsed && f.renewalRightUsed !== "all") sp.set("renewal", f.renewalRightUsed);
  if (typeof f.depositMin === "number") sp.set("dmin", String(f.depositMin));
  if (typeof f.depositMax === "number") sp.set("dmax", String(f.depositMax));
  // areaMin/Max는 ㎡로 정규화돼 있어 round-trip이 부정확함. 평 입력값은 별도로 보존(p)해서 URL에 그대로 둠.
  // serializeFilters는 필터 변경 시 호출되는데, FilterPanel이 직접 pmin/pmax를 다루므로 여기선 무시.
  return sp;
}

export function setPyeongInUrl(sp: URLSearchParams, pmin?: number, pmax?: number): URLSearchParams {
  if (typeof pmin === "number") sp.set("pmin", String(pmin));
  else sp.delete("pmin");
  if (typeof pmax === "number") sp.set("pmax", String(pmax));
  else sp.delete("pmax");
  return sp;
}
