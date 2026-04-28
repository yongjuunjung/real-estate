/**
 * 부동산 중개업소 적재 스크립트 (스켈레톤).
 *
 * 두 가지 옵션 중 하나로 채워야 한다:
 *   1) 공공데이터포털 "국토교통부_부동산중개업조회 서비스" REST API
 *   2) 카카오 로컬 검색 API (FE 표시용으로 좌표 기반 근처 부동산 조회)
 *
 * 본 스크립트는 옵션 1을 가정하고 환경변수 REALTOR_API_KEY를 사용한다.
 * 실제 응답 스키마와 페이지네이션 파라미터는 키 발급 후 응답을 보고 확정한다.
 */
import { getDb } from "@/db";
import { realtors } from "@/db/schema";
import { JUNGNANG_DONGS, JUNGNANG_SIGUNGU_CODE } from "@/lib/constants";

async function run() {
  const apiKey = process.env.REALTOR_API_KEY;
  if (!apiKey) {
    console.error("REALTOR_API_KEY is not set. Skip ingestion.");
    process.exit(1);
  }

  const db = getDb();

  console.log(`[realtors] target sigungu=${JUNGNANG_SIGUNGU_CODE} dongs=${JUNGNANG_DONGS.length}`);

  // TODO: 실제 API 호출/페이징 로직은 응답 샘플 확인 후 작성.
  //   - 시군구 단위 조회 후 dong 필터
  //   - 페이지 단위 조회
  //   - 응답을 realtors 스키마로 변환하여 onConflictDoUpdate

  console.warn("[realtors] not implemented yet — fill in after inspecting sample response");

  // db reference 사용을 위해 잠시 readonly 쿼리 (lint warning 방지)
  void db;
}

if (require.main === module) {
  run()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("[realtors] failed:", err);
      process.exit(1);
    });
}
