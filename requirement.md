# Frontend Requirements

## 애플리케이션 목적

사내 렌탈 PC 관리 시스템 (내부 업무용)
약 900대의 렌탈 PC에 대한 정보를 등록/조회/관리하는 웹 애플리케이션

## 페이지 구성

| 페이지 | 경로 | 설명 |
|--------|------|------|
| 대시보드 | `/` | 진입점. 렌탈 현황 요약 정보 제공 |
| 렌탈 PC 목록 | `/rental` | 전체 렌탈 PC 목록 조회 |

## 기술 스택

| 카테고리 | 라이브러리 | 버전 |
|---------|----------|------|
| Framework | Next.js | 16.2.1 |
| UI Library | React | 19.2.0 |
| Language | TypeScript | 5.8.2 |
| Styling | Tailwind CSS | 4.1.0 |
| UI Components | shadcn/ui | 4.1.1 |
| 클라이언트 상태 | Zustand | 5.x |
| 서버 상태 | TanStack Query | 5.x |
| Linter | ESLint | 9.22.0 |

## 프로젝트 구조

```
frontend/
├── src/
│   ├── app/          # Next.js App Router 페이지
│   ├── components/
│   │   └── ui/       # shadcn/ui 컴포넌트
│   ├── lib/          # 유틸리티, API 클라이언트
│   ├── providers/    # React Context Provider 모음
│   ├── store/        # Zustand 스토어
│   └── types/        # TypeScript 타입 정의
├── public/           # 정적 파일
└── ...설정 파일들
```

- 라우팅은 App Router(`src/app/`) 방식 사용
- 경로 alias: `@/*` → `./src/*`

## 환경 변수

| 변수명 | 설명 |
|--------|------|
| `NEXT_PUBLIC_API_URL` | 백엔드 API 서버 주소 (기본값: `http://localhost:8080`) |

- `NEXT_PUBLIC_` 접두사가 있는 변수만 클라이언트에서 접근 가능
- 환경 변수는 `.env.local`에 관리

## 상태 관리

### 클라이언트 상태 — Zustand
- 전역 UI 상태, 인증 정보 등 클라이언트 전용 상태 관리
- 스토어 파일은 `src/store/` 폴더에 도메인별로 작성
- `src/store/index.ts`에서 일괄 export

### 서버 상태 — TanStack Query
- 서버 데이터 fetching, caching, 동기화는 TanStack Query 사용
- `src/providers/query-provider.tsx`가 루트 레이아웃에 등록됨
- 기본 설정: `staleTime` 60초, `retry` 1회
- 개발 환경에서 ReactQueryDevtools 활성화
- `src/lib/api.ts`의 `fetchApi` 함수를 query function으로 활용

## API 통신

- `src/lib/api.ts`의 `fetchApi` 함수를 통해 API 호출
- `Content-Type: application/json` 헤더 기본 적용
- API Base URL은 `NEXT_PUBLIC_API_URL` 환경 변수 사용

## 타입 정의

- 모든 타입은 `src/types/index.ts`에 정의
- API 응답은 `ApiResponse<T>` 인터페이스 사용
- 페이지네이션 응답은 `PageResponse<T>` 인터페이스 사용

```typescript
interface ApiResponse<T> {
  data: T
  message: string
  success: boolean
}

interface PageResponse<T> {
  content: T[]
  totalElements: number
  totalPages: number
  size: number
  number: number
}
```

## 스타일링 & UI 컴포넌트

- Tailwind CSS 4.x 사용
- 전역 스타일은 `src/app/globals.css`에 작성
- 컴포넌트 인라인 스타일 지양, Tailwind 클래스 사용
- UI 컴포넌트는 shadcn/ui 우선 사용 (`npx shadcn@latest add <component>`)
- shadcn 컴포넌트는 `src/components/ui/`에 위치

## 코딩 컨벤션

- 컴포넌트 파일명: PascalCase (예: `ProductCard.tsx`)
- 유틸리티/훅 파일명: camelCase (예: `useProduct.ts`)
- 페이지 파일명: Next.js 규칙 준수 (`page.tsx`, `layout.tsx` 등)

---

## 추가 가이드라인

> 이후 요청에 따라 가이드라인이 추가됩니다.
