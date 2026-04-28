import type { NewTransaction } from "@/db/schema";
import type { RawAptRentItem } from "./public-data";

const numericStr = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const cleaned = String(v).replace(/,/g, "").trim();
  if (cleaned === "") return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
};

const ensureFiniteInt = (v: unknown, label: string): number => {
  const n = numericStr(v);
  if (n === null) throw new Error(`Invalid integer for ${label}: ${String(v)}`);
  return Math.trunc(n);
};

const padded2 = (v: unknown): string => {
  const n = numericStr(v);
  if (n === null) throw new Error(`Invalid date part: ${String(v)}`);
  return String(Math.trunc(n)).padStart(2, "0");
};

/**
 * 계약기간 문자열을 (start, end) ISO 날짜로 변환.
 * 입력 예: "24.07~26.07", "202407~202607"
 * 일자가 없으므로 시작은 해당 월의 1일, 종료는 해당 월의 1일로 둔다.
 */
function parseContractTerm(term: string | undefined): {
  start: string | null;
  end: string | null;
} {
  if (!term || typeof term !== "string") return { start: null, end: null };
  const cleaned = term.replace(/\s+/g, "");
  const m = cleaned.match(/^(\d{2,6})[.-]?(\d{1,2})?~(\d{2,6})[.-]?(\d{1,2})?$/);
  if (!m) return { start: null, end: null };

  const expand = (yearPart: string, monthPart: string | undefined): string | null => {
    let year: string;
    let month: string;
    if (yearPart.length === 6) {
      year = yearPart.slice(0, 4);
      month = yearPart.slice(4, 6);
    } else if (yearPart.length === 4 && monthPart) {
      year = yearPart;
      month = monthPart.padStart(2, "0");
    } else if (yearPart.length === 2 && monthPart) {
      year = `20${yearPart}`;
      month = monthPart.padStart(2, "0");
    } else {
      return null;
    }
    return `${year}-${month}-01`;
  };

  return {
    start: expand(m[1], m[2]),
    end: expand(m[3], m[4]),
  };
}

function parseRenewalRight(value: string | undefined): boolean | null {
  if (!value) return null;
  const v = value.trim().toUpperCase();
  if (v === "Y" || v === "TRUE" || v === "사용") return true;
  if (v === "N" || v === "FALSE" || v === "미사용") return false;
  return null;
}

function normalizeContractType(value: string | undefined): "신규" | "갱신" | null {
  if (!value) return null;
  const v = value.trim();
  if (v === "신규" || v === "갱신") return v;
  return null;
}

export interface TransformResult {
  row: Omit<NewTransaction, "apartmentId">;
  apartmentKey: { dong: string; jibun: string | null; name: string };
}

export function transformAptRent(item: RawAptRentItem): TransformResult | null {
  if (!item.umdNm || !item.aptNm) return null;
  if (!item.dealYear || !item.dealMonth || !item.dealDay) return null;
  if (item.deposit === undefined || item.deposit === null) return null;
  if (item.excluUseAr === undefined || item.excluUseAr === null) return null;

  const dong = item.umdNm.trim();
  const jibun = item.jibun?.toString().trim() || null;
  const name = item.aptNm.trim();
  const sigungu = item.sggCd?.toString() ?? "";

  const contractDate = `${item.dealYear}-${padded2(item.dealMonth)}-${padded2(item.dealDay)}`;
  const deposit = ensureFiniteInt(item.deposit, "deposit");
  const monthlyRent = numericStr(item.monthlyRent) ?? 0;
  const exclusiveArea = String(numericStr(item.excluUseAr) ?? 0);
  const floor = numericStr(item.floor);
  const buildYear = numericStr(item.buildYear);

  const term = parseContractTerm(item.contractTerm);
  const contractType = normalizeContractType(item.contractType);
  const renewalRightUsed = parseRenewalRight(item.useRRRight);

  const sourceKey = [
    sigungu,
    dong,
    jibun ?? "-",
    name,
    contractDate,
    String(deposit),
    String(monthlyRent),
    exclusiveArea,
    floor ?? "-",
  ].join("|");

  return {
    apartmentKey: { dong, jibun, name },
    row: {
      sigunguCode: sigungu,
      dong,
      jibun,
      apartmentName: name,
      leaseType: monthlyRent > 0 ? "월세" : "전세",
      exclusiveArea,
      floor: floor !== null ? Math.trunc(floor) : null,
      contractDate,
      deposit,
      monthlyRent: Math.trunc(monthlyRent),
      contractTermStart: term.start,
      contractTermEnd: term.end,
      contractType,
      renewalRightUsed,
      buildingYear: buildYear !== null ? Math.trunc(buildYear) : null,
      sourceKey,
      rawPayload: item as unknown as Record<string, unknown>,
    },
  };
}
