import postgres from "postgres";
import { sigunguName } from "@/lib/sigungu";

const KEY = process.env.KAKAO_REST_API_KEY;
if (!KEY) {
  console.error("KAKAO_REST_API_KEY is not set in .env.local");
  process.exit(1);
}

interface KakaoDoc {
  x: string; // longitude
  y: string; // latitude
  place_name?: string;
  category_name?: string;
  road_address_name?: string;
  address_name?: string;
}

async function searchKeyword(query: string): Promise<KakaoDoc | null> {
  const url = new URL("https://dapi.kakao.com/v2/local/search/keyword.json");
  url.searchParams.set("query", query);
  url.searchParams.set("size", "5");
  const res = await fetch(url, {
    headers: { Authorization: `KakaoAK ${KEY}` },
  });
  if (!res.ok) return null;
  const data: { documents?: KakaoDoc[] } = await res.json();
  if (!data.documents || data.documents.length === 0) return null;
  // 카테고리에 "아파트"가 들어간 문서를 우선
  const apt = data.documents.find((d) => (d.category_name ?? "").includes("아파트"));
  return apt ?? data.documents[0];
}

async function searchAddress(query: string): Promise<KakaoDoc | null> {
  const url = new URL("https://dapi.kakao.com/v2/local/search/address.json");
  url.searchParams.set("query", query);
  url.searchParams.set("size", "1");
  const res = await fetch(url, {
    headers: { Authorization: `KakaoAK ${KEY}` },
  });
  if (!res.ok) return null;
  const data: { documents?: KakaoDoc[] } = await res.json();
  return data.documents?.[0] ?? null;
}

async function main() {
  const sql = postgres(process.env.DATABASE_URL!, { prepare: false });

  const apts = await sql<
    { id: number; name: string; dong: string; jibun: string | null; sigungu_code: string }[]
  >`
    SELECT id, name, dong, jibun, sigungu_code
    FROM jungnang.apartments
    WHERE lat IS NULL OR lon IS NULL
    ORDER BY id
  `;

  console.log(`[geocode] ${apts.length}개 단지 처리 시작`);
  let ok = 0;
  let fail = 0;
  const failed: { id: number; name: string; dong: string }[] = [];

  for (let i = 0; i < apts.length; i++) {
    const a = apts[i];
    const sgu = sigunguName(a.sigungu_code);

    let doc: KakaoDoc | null = null;
    let strategy = "";

    // 1차: 단지명 + 동 (키워드 검색)
    doc = await searchKeyword(`${a.name} ${a.dong}`);
    if (doc) strategy = "keyword(name+dong)";

    // 2차: 시군구 + 동 + 지번 → 도로명/지번 주소 검색
    if (!doc && a.jibun) {
      doc = await searchAddress(`${sgu} ${a.dong} ${a.jibun}`);
      if (doc) strategy = "address(jibun)";
    }

    // 3차: 시군구 + 단지명 (다른 동에서 검색돼도 일단 가까이는 됨)
    if (!doc) {
      doc = await searchKeyword(`${sgu} ${a.name}`);
      if (doc) strategy = "keyword(sgu+name)";
    }

    if (doc) {
      const lat = Number(doc.y);
      const lon = Number(doc.x);
      if (Number.isFinite(lat) && Number.isFinite(lon)) {
        await sql`
          UPDATE jungnang.apartments
          SET lat = ${lat}, lon = ${lon}, updated_at = NOW()
          WHERE id = ${a.id}
        `;
        ok += 1;
      } else {
        fail += 1;
        failed.push({ id: a.id, name: a.name, dong: a.dong });
      }
    } else {
      fail += 1;
      failed.push({ id: a.id, name: a.name, dong: a.dong });
    }

    if ((i + 1) % 50 === 0 || i === apts.length - 1) {
      console.log(`[geocode] ${i + 1}/${apts.length} (ok=${ok} fail=${fail})`);
    }
    // 분당 카카오 무료 한도 여유롭게 — 약 5 req/sec
    await new Promise((r) => setTimeout(r, 200));
    void strategy;
  }

  console.log(`[geocode] done. ok=${ok} fail=${fail}`);
  if (failed.length > 0) {
    console.log("[geocode] failed samples (max 10):");
    for (const f of failed.slice(0, 10)) console.log(`  - id=${f.id} ${f.dong} ${f.name}`);
  }

  await sql.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
