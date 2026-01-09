# FixHive 변경 기록 (Changelog)

## 프로젝트 정보
- **이름**: FixHive
- **설명**: OpenCode를 위한 커뮤니티 기반 오류 지식 공유 시스템
- **GitHub**: https://github.com/TheMagicTower/FixHive
- **npm**: https://www.npmjs.com/package/@the-magic-tower/fixhive-opencode-plugin

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
