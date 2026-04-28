import { z } from "zod";

const APT_RENT_ENDPOINT =
  "https://apis.data.go.kr/1613000/RTMSDataSvcAptRent/getRTMSDataSvcAptRent";

const RawItemSchema = z
  .object({
    sggCd: z.union([z.string(), z.number()]).optional(),
    umdNm: z.string().optional(),
    jibun: z.union([z.string(), z.number()]).optional(),
    aptNm: z.string().optional(),
    excluUseAr: z.union([z.string(), z.number()]).optional(),
    floor: z.union([z.string(), z.number()]).optional(),
    dealYear: z.union([z.string(), z.number()]).optional(),
    dealMonth: z.union([z.string(), z.number()]).optional(),
    dealDay: z.union([z.string(), z.number()]).optional(),
    deposit: z.union([z.string(), z.number()]).optional(),
    monthlyRent: z.union([z.string(), z.number()]).optional(),
    contractTerm: z.string().optional(),
    contractType: z.string().optional(),
    useRRRight: z.string().optional(),
    buildYear: z.union([z.string(), z.number()]).optional(),
  })
  .passthrough();

const ResponseSchema = z.object({
  response: z.object({
    header: z.object({
      resultCode: z.string(),
      resultMsg: z.string(),
    }),
    body: z
      .object({
        items: z
          .union([
            z.object({ item: z.union([RawItemSchema, z.array(RawItemSchema)]) }),
            z.string(),
            z.literal(""),
          ])
          .optional(),
        totalCount: z.union([z.string(), z.number()]).optional(),
        pageNo: z.union([z.string(), z.number()]).optional(),
        numOfRows: z.union([z.string(), z.number()]).optional(),
      })
      .optional(),
  }),
});

export type RawAptRentItem = z.infer<typeof RawItemSchema>;

export interface FetchAptRentArgs {
  /** 5자리 시군구 코드 (예: 중랑구 = 11260) */
  lawdCode: string;
  /** YYYYMM (계약년월) */
  dealYearMonth: string;
  pageNo?: number;
  numOfRows?: number;
}

export async function fetchAptRentPage(
  args: FetchAptRentArgs,
): Promise<{ items: RawAptRentItem[]; totalCount: number }> {
  const serviceKey = process.env.DATA_GO_KR_KEY;
  if (!serviceKey) {
    throw new Error("DATA_GO_KR_KEY is not set");
  }

  const url = new URL(APT_RENT_ENDPOINT);
  url.searchParams.set("serviceKey", serviceKey);
  url.searchParams.set("LAWD_CD", args.lawdCode);
  url.searchParams.set("DEAL_YMD", args.dealYearMonth);
  url.searchParams.set("pageNo", String(args.pageNo ?? 1));
  url.searchParams.set("numOfRows", String(args.numOfRows ?? 1000));
  url.searchParams.set("_type", "json");

  const res = await fetch(url, {
    cache: "no-store",
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; jungnang-jeonse/1.0)",
      Accept: "application/json",
    },
  });
  if (!res.ok) {
    throw new Error(`Public data API error: ${res.status} ${res.statusText}`);
  }

  const json: unknown = await res.json();
  const parsed = ResponseSchema.parse(json);

  const header = parsed.response.header;
  if (header.resultCode !== "00" && header.resultCode !== "000") {
    throw new Error(`Public data API non-OK: ${header.resultCode} ${header.resultMsg}`);
  }

  const body = parsed.response.body;
  const totalCount = Number(body?.totalCount ?? 0);

  let items: RawAptRentItem[] = [];
  if (body?.items && typeof body.items === "object") {
    const rawItem = body.items.item;
    if (Array.isArray(rawItem)) items = rawItem;
    else if (rawItem) items = [rawItem];
  }

  return { items, totalCount };
}

export async function fetchAllAptRent(
  args: Omit<FetchAptRentArgs, "pageNo">,
): Promise<RawAptRentItem[]> {
  const numOfRows = args.numOfRows ?? 1000;
  const collected: RawAptRentItem[] = [];
  let pageNo = 1;

  while (true) {
    const { items, totalCount } = await fetchAptRentPage({ ...args, pageNo, numOfRows });
    collected.push(...items);
    if (collected.length >= totalCount || items.length === 0) break;
    pageNo += 1;
  }

  return collected;
}
