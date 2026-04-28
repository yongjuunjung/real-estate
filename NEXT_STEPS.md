# 다음에 진행할 일 체크리스트

> 1차 스캐폴딩은 완료. 이 문서대로 키 발급 → 환경설정 → 검증 → 본구현 순으로 진행한다.

---

## Phase 1. 외부 계정·키 발급 (1~2일 소요)

### 1-1. 공공데이터포털 가입 + 활용 신청

- [ ] https://www.data.go.kr 회원가입 (소셜 로그인 가능)
- [ ] **"국토교통부_아파트 전월세 자료"** 검색 → 활용신청
  - URL: https://www.data.go.kr/data/15126474/openapi.do (검색해서 확인)
  - 활용 목적: "개인 학습/리서치용 전월세 데이터 시각화"
  - 자동승인 또는 1영업일 이내 승인
- [ ] **"국토교통부_부동산중개업조회 서비스"** 검색 → 활용신청
- [ ] 승인 후 **마이페이지 → 인증키 발급현황**에서
  - **일반 인증키 (Decoding)** 값을 복사 (Encoding 키 아님 주의)

### 1-2. 카카오 개발자 앱 등록 (즉시)

- [ ] https://developers.kakao.com 로그인 → **내 애플리케이션 → 애플리케이션 추가**
- [ ] 앱 이름: `중랑 전세 트래커` (자유)
- [ ] 생성 후 **앱 키 → JavaScript 키** 복사
- [ ] **플랫폼 → Web 플랫폼 등록**에 다음 URL 추가
  - `http://localhost:3000`
  - 배포 후엔 Vercel 도메인도 추가 (예: `https://jungnang-jeonse.vercel.app`)

### 1-3. Neon Postgres 프로비저닝

택일:
- **A. Vercel Marketplace 경유 (권장)**
  - [ ] https://vercel.com 로그인 → 프로젝트 만들기 (이 레포 아직 import 안 했으면 GitHub에 push 후 import)
  - [ ] Storage → Marketplace → Neon 추가
  - [ ] 프로젝트 자동 연동되며 `DATABASE_URL` 등 환경변수가 자동 주입됨
- **B. Neon 직접 가입**
  - [ ] https://neon.tech 가입 → 프로젝트 생성 (region: AWS Asia/Tokyo 또는 Singapore)
  - [ ] Connection string 복사 (`postgresql://user:pass@...`)

---

## Phase 2. 로컬 환경 세팅

```bash
cd ~/dev/jungnang-jeonse
cp .env.example .env.local
```

`.env.local` 채우기:

```env
DATA_GO_KR_KEY=<공공데이터포털 일반 인증키 Decoding>
REALTOR_API_KEY=<공공데이터포털 부동산중개업 인증키 Decoding>
NEXT_PUBLIC_KAKAO_MAP_KEY=<카카오 JavaScript 키>
DATABASE_URL=postgresql://...
```

> Vercel Marketplace 경로로 Neon 만들었으면 `DATABASE_URL` 대신:
> ```bash
> vercel link
> vercel env pull .env.local --yes
> ```

---

## Phase 3. DB 마이그레이션

```bash
pnpm install                # 못 했으면
pnpm db:push                # 스키마를 Neon에 반영
pnpm db:studio              # 브라우저에서 테이블 확인 (optional)
```

확인할 것:
- [ ] `apartments`, `transactions`, `realtors` 3개 테이블 생성됨
- [ ] `transactions.contract_term_end`, `renewal_right_used`, `contract_type` 컬럼 존재

---

## Phase 4. API 응답 샘플 확인 (중요)

내가 `src/lib/public-data.ts` / `src/lib/transform.ts`에서 가정한 필드명이 실제 응답과 맞는지 검증해야 한다. 메모리로 작성한 거라 한 글자 차이로 깨질 수 있음.

```bash
# 샘플 한 달치 직접 호출해서 응답 확인
curl "https://apis.data.go.kr/1613000/RTMSDataSvcAptRent/getRTMSDataSvcAptRent?serviceKey=$DATA_GO_KR_KEY&LAWD_CD=11260&DEAL_YMD=202407&pageNo=1&numOfRows=5&_type=json" | jq '.'
```

확인 포인트:
- [ ] `response.body.items.item[].umdNm` 존재 (법정동)
- [ ] `aptNm`, `excluUseAr`, `floor`, `dealYear/Month/Day` 존재
- [ ] **`contractTerm`, `contractType`, `useRRRight`** 존재 (없으면 다른 키 이름인지 확인)
- [ ] `deposit`, `monthlyRent` 형식 (콤마 포함 문자열인지 숫자인지)

만약 필드명이 다르면 → `src/lib/public-data.ts`의 `RawItemSchema`와 `src/lib/transform.ts`의 매핑을 수정.

---

## Phase 5. 데이터 적재

```bash
# 중랑구 최근 24개월치 적재 (시간 좀 걸림, 월별로 페이징)
pnpm ingest:transactions
```

확인:
```bash
pnpm db:studio
# transactions 테이블에 수천 건 들어갔는지 확인
```

---

## Phase 6. 부동산 중개업소 적재 (본구현)

`scripts/ingest-realtors.ts`는 현재 스켈레톤 상태. API 응답 보고 채워야 함.

작업 순서:
- [ ] 공공데이터 "부동산중개업조회" API 응답 한 건 받아보기
- [ ] `src/db/schema.ts`의 `realtors` 컬럼과 매핑 작성
- [ ] 시군구코드 `11260`(중랑구)으로 전체 페이지 순회 + upsert
- [ ] (선택) 카카오 로컬 검색으로 좌표 보강

---

## Phase 7. UI 본구현

순서대로:

### 7-1. 만료 임박 매물 마커 표시
- [ ] `/api/expiring-leases?from=YYYY-MM-DD&to=YYYY-MM-DD` Route Handler 작성
- [ ] 단지별 그룹핑 + 마커 클러스터
- [ ] 필터 패널 (만료 시점 ±3개월 / 갱신권 사용여부 / 보증금 / 평형)

### 7-2. 매물 클릭 시 사이드 패널
- [ ] 단지 상세 (계약 이력, 갱신권 사용 여부)
- [ ] 반경 500m 부동산 리스트 (이름·전화·주소)
- [ ] 부동산 클릭 시 카카오맵 마커 강조

### 7-3. (선택) 즐겨찾기·알림
- [ ] localStorage 기반 즐겨찾기
- [ ] 만료 1개월 전 이메일 알림 (Vercel Cron + 이메일 서비스)

---

## Phase 8. 배포 + 자동 적재

- [ ] GitHub에 push (private 추천)
- [ ] Vercel 프로젝트 import → 환경변수 등록
- [ ] `vercel.ts`에 Cron 등록 (매월 1일 새벽 3시)
  ```ts
  crons: [{ path: '/api/cron/ingest', schedule: '0 18 1 * *' }]  // KST 03:00
  ```
- [ ] `/api/cron/ingest` Route Handler 작성 (직전 월 1개월치 적재)

---

## 막히면 확인할 것

| 증상 | 확인 |
|---|---|
| `DATABASE_URL is not set` | `.env.local` 채웠는지 / 스크립트는 `dotenv -e .env.local -- ...` 형식인지 |
| 카카오맵 안 뜸 | JavaScript 키 맞는지 / 플랫폼에 `http://localhost:3000` 등록했는지 / 콘솔에 CORS/도메인 에러 있는지 |
| 공공데이터 `SERVICE_KEY_IS_NOT_REGISTERED_ERROR` | Decoding 키 사용했는지 / 활용신청 승인 됐는지 |
| 응답이 XML로 옴 | `_type=json` 파라미터 빠졌는지 |
| 마이그레이션 권한 에러 | Neon connection string에 `?sslmode=require` 붙었는지 |

---

## 결정 보류된 것들 (나중에 정해도 됨)

- [ ] 다세대/연립 데이터도 포함할지 (현재 아파트만)
- [ ] 좌표 지오코딩 캐싱 전략 (단지명+지번 → 좌표)
- [ ] 전화번호 클릭 시 동작 (`tel:` 링크 vs 카카오맵으로 이동)
- [ ] 다크모드 기본값
- [ ] 도메인 (vercel.app 서브도메인 그대로 vs 커스텀)
