# 중랑 전세 트래커

서울시 중랑구의 **이미 체결된 전월세 실거래** 데이터를 기반으로,
- **곧 만료 예정인 전세 매물**을 역산해 보여주고
- **해당 매물 근처 부동산 중개업소**를 함께 표시해 컨택을 쉽게 하기 위한 웹앱.

> 매물 트래킹이 아니라 *과거 거래 → 만료 추정*입니다. 한계: 묵시적 갱신·조기 해지·동/호수 미공개.

## 스택

- Next.js 16 (App Router) + TypeScript + Tailwind v4
- Drizzle ORM + Neon Postgres
- 카카오맵 JavaScript SDK
- shadcn/ui (radix-ui 기반)
- Vercel + Vercel Cron (월 1회 적재)

## 데이터 소스

| 용도 | 출처 | 활용 신청 |
|---|---|---|
| 전월세 실거래가 | 국토교통부 (공공데이터포털) | "국토교통부_아파트 전월세 자료" |
| 부동산 중개업소 | 국토교통부 (공공데이터포털) | "국토교통부_부동산중개업조회 서비스" |
| 지도 표시 | Kakao Maps | https://developers.kakao.com |

전월세 응답에는 `contractTerm`(계약기간), `contractType`(신규/갱신), `useRRRight`(갱신요구권 사용여부) 필드가 포함되어 있어 **갱신권 사용 여부 + 만료 시점**을 함께 추정할 수 있습니다.

## 첫 구동 절차

### 1. 환경변수

```bash
cp .env.example .env.local
```

채워야 할 값:
- `DATA_GO_KR_KEY` — 공공데이터포털 일반 인증키 (Decoding) 권장
- `REALTOR_API_KEY` — 위와 동일하게 발급한 부동산 중개업 조회 키
- `NEXT_PUBLIC_KAKAO_MAP_KEY` — 카카오 JavaScript 키 (플랫폼에 `http://localhost:3000` 등록 필수)
- `DATABASE_URL` — Neon Postgres 연결 문자열

> Vercel Marketplace로 Neon을 프로비저닝한 경우 `vercel env pull .env.local --yes`로 자동 주입.

### 2. 의존성 설치

```bash
pnpm install
```

### 3. 스키마 마이그레이션

```bash
pnpm db:generate    # 스키마 변경 시 마이그레이션 파일 생성
pnpm db:push        # 변경사항을 DB에 반영 (개발용)
pnpm db:studio      # GUI에서 데이터 확인
```

### 4. 데이터 적재 (1회성)

```bash
# 최근 24개월치 중랑구 아파트 전월세
pnpm ingest:transactions

# 부동산 중개업소 (스켈레톤, 응답 샘플 확인 후 구현 예정)
pnpm ingest:realtors
```

### 5. 개발 서버

```bash
pnpm dev
# → http://localhost:3000
```

## 디렉토리 구조

```
src/
  app/                      # Next.js App Router
  components/
    map/jungnang-map.tsx    # 카카오맵 클라이언트 컴포넌트
    ui/                     # shadcn/ui 생성 컴포넌트
  db/
    index.ts                # 지연 초기화 DB 클라이언트 (lazy getDb)
    schema.ts               # Drizzle 스키마: apartments / transactions / realtors
  lib/
    constants.ts            # 중랑구 좌표·법정동 상수
    public-data.ts          # 공공데이터 API 호출
    transform.ts            # API 응답 → DB row 변환
scripts/
  ingest-transactions.ts    # 전월세 실거래 적재
  ingest-realtors.ts        # 부동산 적재 (구현 예정)
drizzle/                    # 자동 생성 마이그레이션
```

## 주요 한계

- 도로명/지번까지만 공개되어 **동·호 단위 추적은 불가** (단지+층 단위)
- 묵시적 갱신·조기 해지는 데이터에 잡히지 않음 → 만료 추정이 빗나갈 수 있음
- 빌라/단독은 신고율이 낮아 sparse — v1은 아파트만
- 공공데이터 API는 일일 호출 한도가 있어 **사전 적재 후 DB에서 조회**하는 구조

## TODO (우선순위 순)

- [ ] API 키 발급 후 응답 샘플 확인 → `transform.ts` 필드 매핑 검증
- [ ] 부동산 중개업소 적재 스크립트 본구현
- [ ] 단지 좌표 지오코딩 (카카오 로컬 검색)
- [ ] 만료 임박 매물 필터 + 마커 클러스터
- [ ] 매물 클릭 → 반경 500m 부동산 리스트 사이드 패널
- [ ] Vercel Cron으로 월 1회 자동 적재
