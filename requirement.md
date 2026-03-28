# Frontend Requirements

## 기술 스택

| 카테고리 | 라이브러리 | 버전 |
|---------|----------|------|
| Framework | Next.js | 16.2.1 |
| UI Library | React | 19.2.0 |
| Language | TypeScript | 5.8.2 |
| Styling | Tailwind CSS | 4.1.0 |
| Linter | ESLint | 9.22.0 |

## 프로젝트 구조

```
frontend/
├── src/
│   ├── app/          # Next.js App Router 페이지
│   ├── components/   # 재사용 컴포넌트
│   ├── lib/          # 유틸리티, API 클라이언트
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

## 스타일링

- Tailwind CSS 4.x 사용
- 전역 스타일은 `src/app/globals.css`에 작성
- 컴포넌트 인라인 스타일 지양, Tailwind 클래스 사용

## 코딩 컨벤션

- 컴포넌트 파일명: PascalCase (예: `ProductCard.tsx`)
- 유틸리티/훅 파일명: camelCase (예: `useProduct.ts`)
- 페이지 파일명: Next.js 규칙 준수 (`page.tsx`, `layout.tsx` 등)

---

## 추가 가이드라인

> 이후 요청에 따라 가이드라인이 추가됩니다.
