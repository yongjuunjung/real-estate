export function formatDeposit(manwon: number): string {
  if (manwon >= 10000) {
    const eok = Math.floor(manwon / 10000);
    const rest = manwon % 10000;
    return rest === 0 ? `${eok}억` : `${eok}억 ${rest.toLocaleString()}`;
  }
  return manwon.toLocaleString();
}

export const M2_PER_PYEONG = 3.3058;

export function m2ToPyeong(m2: number): number {
  return m2 / M2_PER_PYEONG;
}

export function pyeongToM2(pyeong: number): number {
  return pyeong * M2_PER_PYEONG;
}

/** "84.98㎡ / 25.7평" 같은 형태. */
export function formatArea(m2Raw: string | number): string {
  const m2 = typeof m2Raw === "string" ? Number(m2Raw) : m2Raw;
  if (!Number.isFinite(m2)) return String(m2Raw);
  return `${m2.toFixed(2)}㎡ / ${m2ToPyeong(m2).toFixed(1)}평`;
}
