# FixHive 변경 기록 (Changelog)

## 프로젝트 정보
- **이름**: FixHive
- **설명**: OpenCode를 위한 커뮤니티 기반 오류 지식 공유 시스템
- **GitHub**: https://github.com/TheMagicTower/FixHive
- **npm**: https://www.npmjs.com/package/@the-magic-tower/fixhive-opencode-plugin

---

## [0.1.29] - 2026-01-10

### Fixed (수정)
- **Bun 런타임 호환성 문제 해결**
  - `TypeError: fn3 is not a function` 오류 수정
    - 원인: OpenCode가 모든 export를 플러그인 인스턴스로 취급하여 호출
    - 해결: `src/index.ts`에서 default export만 노출하도록 변경
  - `better-sqlite3 is not yet supported in Bun` 오류 수정
    - 원인: better-sqlite3 네이티브 Node.js 애드온이 Bun과 호환되지 않음
    - 해결: 런타임 감지 후 `bun:sqlite` 또는 `better-sqlite3` 동적 선택

### Changed (변경)
- 빌드 시스템 변경: `tsup` → `bun build --target bun --format esm`
- `@opencode-ai/plugin`, `zod`를 dependencies로 이동 (번들에 포함)
- `better-sqlite3`만 external로 유지 (네이티브 모듈)
- `createLocalStore`를 비동기 함수로 변경

### Added (추가)
- `src/types/bun-sqlite.d.ts` - Bun SQLite 타입 선언 추가
- `UnifiedDatabase` 인터페이스 - 크로스 런타임 호환성 지원

### Technical Details
```typescript
// 런타임 감지
const isBun = typeof Bun !== 'undefined';

// 동적 SQLite 선택
if (isBun) {
  const { Database } = await import('bun:sqlite');
} else {
  const BetterSqlite3 = (await import('better-sqlite3')).default;
}
```

---

## [0.1.6] - 2026-01-09

### Documentation (문서)
- README 전면 개편
  - npm/CI 배지 추가
  - 작동 원리 다이어그램 추가
  - 각 도구별 상세 API 문서 추가
  - TypeScript 타입 레퍼런스 추가
  - 프로그래매틱 사용 예시 추가
  - 문제 해결 섹션 추가
  - 테스트 커버리지 정보 추가
- 한국어 README 동기화 업데이트
- MIT LICENSE 파일 추가

---

## [0.1.5] - 2026-01-09

### Fixed (수정)
- TypeScript 선언 파일(.d.ts) 빌드 추가
- zod 버전 충돌 해결 (v4 → v3.23.8)
- tsup `--dts` 플래그 추가

---

## [0.1.4] - 2026-01-09

### Added (추가)
- **테스트 스위트** (151개 테스트, Vitest 기반)
  - Core 모듈 테스트 (privacy-filter, hash, error-detector)
  - Storage 모듈 테스트 (local-store)
  - Cloud 모듈 테스트 (embedding, client)
  - 테스트 커버리지: Core 99%, Storage 98%, Cloud 96%
- **CI/CD 파이프라인** (GitHub Actions)
  - Node.js 18.x, 20.x, 22.x 매트릭스 테스트
  - 자동 빌드 및 타입 체크
  - 테스트 커버리지 리포트 업로드
  - 자동 npm 배포 (태그 푸시 시)
  - Dependabot 자동 의존성 업데이트

---

## [0.1.1] - 2026-01-09

### Security (보안)
- SQL 인젝션 취약점 수정 (`LocalStore.incrementStat` 화이트리스트 검증 추가)
- ReDoS 취약점 수정 (`privacy-filter.ts` 정규식 길이 제한 추가)
- Regex 상태 오염 수정 (`containsSensitiveData` lastIndex 리셋)
- 클라우드 쿼리 에러 핸들링 개선
- 로컬 저장/클라우드 전송 전 프라이버시 필터링 추가

### Documentation (문서)
- 8개 언어 README 지원 추가
  - English (`README.md`)
  - 한국어 (`README.ko.md`)
  - 中文 (`README.zh.md`)
  - 日本語 (`README.ja.md`)
  - Español (`README.es.md`)
  - Deutsch (`README.de.md`)
  - Français (`README.fr.md`)
  - Nederlands (`README.nl.md`)

### Changed
- 패키지명 변경: `@fixhive/opencode-plugin` → `@the-magic-tower/fixhive-opencode-plugin`
- 저장소 이전: `bluelucifer/FixHive` → `TheMagicTower/FixHive`

---

## [0.1.0] - 2026-01-09

### Added (초기 릴리즈)
- 오류 자동 감지 (`tool.execute.after` 훅)
- 프라이버시 필터링 (20+ 정규식 패턴)
  - API 키 (OpenAI, GitHub, AWS, Stripe 등)
  - JWT/Bearer 토큰
  - 이메일 주소
  - 파일 경로
  - 환경 변수
  - DB 연결 문자열
  - IP 주소
- 로컬 SQLite 저장소
  - `error_records` 테이블
  - `query_cache` 테이블
  - `usage_stats` 테이블
- Supabase 클라우드 연동
  - `knowledge_entries` 테이블
  - `usage_logs` 테이블
  - pgvector 시맨틱 검색
- OpenCode 플러그인 도구
  - `fixhive_search`: 오류 솔루션 검색
  - `fixhive_resolve`: 오류 해결 & 공유
  - `fixhive_list`: 세션 오류 목록
  - `fixhive_vote`: 솔루션 평가
  - `fixhive_stats`: 사용 통계
  - `fixhive_helpful`: 도움됨 보고

---

## 기술 스택
- TypeScript (ES2022)
- Supabase (PostgreSQL + pgvector)
- SQLite (better-sqlite3)
- OpenAI Embeddings (text-embedding-3-small, 1536 dimensions)
- OpenCode Plugin API (@opencode-ai/plugin)

## 배포 정보
| 항목 | 값 |
|------|-----|
| npm 계정 | `the_magic_tower` |
| npm scope | `@the-magic-tower` |
| 패키지명 | `@the-magic-tower/fixhive-opencode-plugin` |
| GitHub 조직 | `TheMagicTower` |

## 환경 변수
```bash
# 필수 (클라우드 기능)
FIXHIVE_SUPABASE_URL=https://your-project.supabase.co
FIXHIVE_SUPABASE_KEY=your-anon-key

# 선택 (시맨틱 검색)
OPENAI_API_KEY=sk-...

# 선택 (기여자 ID)
FIXHIVE_CONTRIBUTOR_ID=your-contributor-id
```

## 관련 링크
- [GitHub Repository](https://github.com/TheMagicTower/FixHive)
- [npm Package](https://www.npmjs.com/package/@the-magic-tower/fixhive-opencode-plugin)
- [Release v0.1.1](https://github.com/TheMagicTower/FixHive/releases/tag/v0.1.1)
