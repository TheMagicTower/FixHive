# FixHive

<p align="center">
  <a href="README.md">English</a> |
  <a href="README.ko.md">한국어</a> |
  <a href="README.zh.md">中文</a> |
  <a href="README.ja.md">日本語</a> |
  <a href="README.es.md">Español</a> |
  <a href="README.de.md">Deutsch</a> |
  <a href="README.fr.md">Français</a> |
  <a href="README.nl.md">Nederlands</a>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@the-magic-tower/fixhive-opencode-plugin">
    <img src="https://img.shields.io/npm/v/@the-magic-tower/fixhive-opencode-plugin.svg" alt="npm version">
  </a>
  <a href="https://github.com/SeoulVentures/FixHive/actions/workflows/ci.yml">
    <img src="https://github.com/SeoulVentures/FixHive/actions/workflows/ci.yml/badge.svg" alt="CI Status">
  </a>
  <a href="https://opensource.org/licenses/MIT">
    <img src="https://img.shields.io/badge/License-MIT-yellow.svg" alt="License: MIT">
  </a>
  <img src="https://img.shields.io/badge/Node.js-18%20%7C%2020%20%7C%2022-green" alt="Node.js Version">
</p>

> 커뮤니티 기반 오류 지식 공유 시스템 - OpenCode 플러그인

FixHive는 개발 세션 중 발생하는 오류를 자동으로 감지하고, 커뮤니티 지식 베이스에서 해결책을 검색하며, 해결된 오류를 다른 개발자들과 공유하는 OpenCode 플러그인입니다.

## 주요 기능

- **자동 오류 감지**: 도구 출력(bash, edit 등)에서 자동으로 오류 감지
- **클라우드 지식 베이스**: 시맨틱 유사도 검색으로 커뮤니티 솔루션 검색 (pgvector)
- **로컬 캐싱**: SQLite 기반 로컬 저장소로 오프라인 접근 지원
- **프라이버시 필터링**: 민감한 데이터 자동 마스킹 (API 키, 경로, 이메일)
- **실시간 동기화**: 오류/해결 시 즉시 클라우드 통신
- **중복 방지**: 임베딩과 해시 매칭을 통한 스마트 중복 검사

## 설치

```bash
npm install @the-magic-tower/fixhive-opencode-plugin
```

## 빠른 시작

### 1. 패키지 설치

```bash
npm install @the-magic-tower/fixhive-opencode-plugin
```

### 2. OpenCode 설정 파일(`opencode.json`)에 추가

```json
{
  "plugins": [
    "@the-magic-tower/fixhive-opencode-plugin"
  ]
}
```

### 3. OpenCode 실행

```bash
opencode
```

**끝입니다!** FixHive는 기본적으로 커뮤니티 지식 베이스에 연결됩니다. 환경 변수 설정이 필요 없습니다.

플러그인이 정상 로드되면 다음 로그가 출력됩니다:
```
[FixHive] Plugin loaded
[FixHive] Project: /your/project/path
[FixHive] Cloud: enabled
[FixHive] Ready - use fixhive_stats to verify
```

## 작동 원리

```
┌─────────────────────────────────────────────────────────────────┐
│                       FixHive 흐름도                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   1. 오류 발생                                                   │
│      ↓                                                          │
│   2. 자동 감지 (tool.execute.after 훅)                          │
│      ↓                                                          │
│   3. 프라이버시 필터 (API 키, 경로 등 마스킹)                    │
│      ↓                                                          │
│   4. 로컬 저장 (SQLite)                                         │
│      ↓                                                          │
│   5. 클라우드 검색 (Supabase + pgvector)                        │
│      ↓                                                          │
│   6. 솔루션 표시 (유사도 & 투표순 정렬)                          │
│      ↓                                                          │
│   7. 해결 → 커뮤니티 업로드                                      │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## 설정 (선택사항)

환경 변수로 동작 커스터마이징:

```bash
# 커뮤니티 대신 자체 Supabase 인스턴스 사용
FIXHIVE_SUPABASE_URL=https://your-project.supabase.co
FIXHIVE_SUPABASE_KEY=your-anon-key

# 시맨틱 검색 활성화 (권장)
OPENAI_API_KEY=sk-...

# 커스텀 기여자 ID (설정하지 않으면 자동 생성)
FIXHIVE_CONTRIBUTOR_ID=your-contributor-id
```

| 변수 | 기본값 | 설명 |
|------|--------|------|
| `FIXHIVE_SUPABASE_URL` | 커뮤니티 DB | Supabase 프로젝트 URL |
| `FIXHIVE_SUPABASE_KEY` | 커뮤니티 키 | Supabase anon 키 |
| `OPENAI_API_KEY` | 없음 | 시맨틱 유사도 검색 활성화 |
| `FIXHIVE_CONTRIBUTOR_ID` | 자동 생성 | 고유 기여자 ID |

## 사용 가능한 도구

### `fixhive_search`

지식 베이스에서 오류 해결책 검색.

```typescript
// 인자
{
  errorMessage: string;   // 필수: 검색할 오류 메시지
  language?: string;      // 선택: 프로그래밍 언어 (typescript, python 등)
  framework?: string;     // 선택: 프레임워크 (react, nextjs, express 등)
  limit?: number;         // 선택: 최대 결과 수 (기본값: 5)
}
```

**예시:**
```
fixhive_search "Cannot find module 'react'" --language typescript --framework nextjs
```

### `fixhive_resolve`

오류를 해결됨으로 표시하고 솔루션 공유.

```typescript
// 인자
{
  errorId: string;        // 필수: fixhive_list에서 얻은 오류 ID
  resolution: string;     // 필수: 오류 해결 방법 설명
  resolutionCode?: string; // 선택: 코드 수정 또는 diff
  upload?: boolean;       // 선택: 커뮤니티에 업로드 (기본값: true)
}
```

**예시:**
```
fixhive_resolve abc12345 "의존성 누락. npm install react 실행으로 해결"
```

### `fixhive_list`

현재 세션에서 감지된 오류 목록.

```typescript
// 인자
{
  status?: 'unresolved' | 'resolved' | 'uploaded';  // 선택: 상태로 필터링
  limit?: number;                                    // 선택: 최대 결과 수 (기본값: 10)
}
```

### `fixhive_vote`

솔루션에 투표.

```typescript
// 인자
{
  knowledgeId: string;  // 필수: 지식 항목 ID
  helpful: boolean;     // 필수: true는 추천, false는 비추천
}
```

### `fixhive_stats`

사용 통계 조회.

```typescript
// 인자 없음
```

**출력:**
```markdown
## FixHive 통계

### 로컬
- 기록된 오류: 42
- 해결됨: 38
- 업로드됨: 25

### 커뮤니티 기여
- 공유한 솔루션: 25
- 내 솔루션이 도움 준 횟수: 156
- 받은 총 추천: 89
```

### `fixhive_helpful`

솔루션이 도움이 되었다고 보고.

```typescript
// 인자
{
  knowledgeId: string;  // 필수: 도움이 된 지식 항목 ID
}
```

### `fixhive_report`

부적절한 콘텐츠 신고.

```typescript
// 인자
{
  knowledgeId: string;  // 필수: 신고할 지식 항목 ID
  reason?: string;      // 선택: 신고 사유
}
```

## 예시 워크플로우

```
1. 실패하는 명령 실행
   $ npm run build
   > error TS2307: Cannot find module '@/components/Button'

2. FixHive 자동 동작:
   - 오류 감지
   - 로컬에 기록
   - 솔루션 검색
   - 매칭되는 커뮤니티 솔루션 표시

3. 커뮤니티 솔루션의 수정 적용
   $ npm install @/components/Button --save

4. 해결 표시 및 공유
   fixhive_resolve <error-id> "tsconfig.json에 경로 별칭 설정 누락. paths 매핑 추가."

5. 당신의 솔루션이 다른 개발자들을 돕습니다!
```

## 프라이버시

FixHive는 공유 전 민감한 정보를 자동으로 필터링합니다:

| 카테고리 | 예시 | 대체값 |
|----------|------|--------|
| API 키 | `sk-abc123...`, `ghp_xxx...` | `[API_KEY_REDACTED]` |
| 토큰 | `Bearer eyJ...`, `xoxb-...` | `[TOKEN_REDACTED]` |
| 이메일 | `user@example.com` | `[EMAIL_REDACTED]` |
| 경로 | `/Users/john/projects/...` | `~/projects/...` |
| 환경변수 | `DATABASE_URL=postgres://...` | `[ENV_REDACTED]` |
| 연결 문자열 | `mongodb://user:pass@...` | `[CONNECTION_STRING_REDACTED]` |
| IP 주소 | `192.168.1.100` | `[IP_REDACTED]` |

## 자체 호스팅 설정 (선택사항)

기본 커뮤니티 지식 베이스를 사용한다면 이 섹션을 건너뛰세요.

### 1. Supabase 프로젝트 생성

1. [supabase.com](https://supabase.com)에서 새 프로젝트 생성 (무료 티어 가능)
2. 프로젝트가 준비될 때까지 대기

### 2. pgvector 확장 활성화

SQL 에디터에서 실행:
```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

### 3. 설정 스크립트 실행

`scripts/setup-supabase.sql` 내용을 SQL 에디터에서 복사하여 실행.

### 4. 환경 설정

```bash
# Settings > API에서 가져오기
FIXHIVE_SUPABASE_URL=https://your-project.supabase.co
FIXHIVE_SUPABASE_KEY=your-anon-key
```

## 아키텍처

```
@the-magic-tower/fixhive-opencode-plugin
├── src/
│   ├── plugin/
│   │   ├── index.ts          # 플러그인 정의 (훅)
│   │   └── tools.ts          # 커스텀 도구 (7개)
│   ├── core/
│   │   ├── error-detector.ts # 다중 신호 오류 감지
│   │   ├── privacy-filter.ts # 민감 데이터 마스킹
│   │   └── hash.ts           # 핑거프린팅 & 중복 검사
│   ├── storage/
│   │   ├── local-store.ts    # SQLite 로컬 저장소
│   │   └── migrations.ts     # 데이터베이스 마이그레이션
│   ├── cloud/
│   │   ├── client.ts         # Supabase 클라이언트
│   │   └── embedding.ts      # OpenAI 임베딩
│   └── types/
│       └── index.ts          # TypeScript 정의
└── scripts/
    └── setup-supabase.sql    # 클라우드 스키마
```

## API 레퍼런스

### TypeScript 타입

```typescript
import type {
  LocalErrorRecord,
  CloudKnowledgeEntry,
  ErrorType,
  ErrorStatus,
  Language,
  Severity,
} from '@the-magic-tower/fixhive-opencode-plugin';

// 오류 타입
type ErrorType =
  | 'runtime' | 'build' | 'lint' | 'test'
  | 'network' | 'permission' | 'dependency'
  | 'syntax' | 'type_error' | 'unknown';

// 오류 상태
type ErrorStatus = 'unresolved' | 'resolved' | 'uploaded';

// 지원 언어
type Language =
  | 'typescript' | 'javascript' | 'python' | 'rust'
  | 'go' | 'java' | 'ruby' | 'php' | 'csharp' | 'cpp' | 'other';
```

### 프로그래매틱 사용

```typescript
import {
  ErrorDetector,
  PrivacyFilter,
  LocalStore,
  CloudClient,
  createEmbeddingService,
} from '@the-magic-tower/fixhive-opencode-plugin';

// 인스턴스 생성
const detector = new ErrorDetector();
const filter = new PrivacyFilter();
const store = new LocalStore('/path/to/project');
const cloud = new CloudClient({
  supabaseUrl: 'https://xxx.supabase.co',
  supabaseAnonKey: 'your-key',
});

// 오류 감지
const result = detector.detect({
  tool: 'bash',
  output: 'error TS2307: Cannot find module...',
  exitCode: 1,
});

// 콘텐츠 정제
const sanitized = filter.sanitize('API key: sk-abc123...');
// { sanitized: 'API key: [API_KEY_REDACTED]', redactedCount: 1, ... }

// 솔루션 검색
const solutions = await cloud.searchSimilar({
  errorMessage: 'Module not found',
  language: 'typescript',
});
```

## 문제 해결

### 플러그인이 로드되지 않음

OpenCode v1.1.1 이상인지 확인:
```bash
npm list @opencode-ai/plugin
```

### 솔루션을 찾을 수 없음

1. 시맨틱 검색을 위해 `OPENAI_API_KEY`가 설정되어 있는지 확인
2. 더 넓은 검색어 시도
3. 희귀한 오류는 커뮤니티 데이터베이스에 솔루션이 아직 없을 수 있음

### 프라이버시 우려

FixHive는 자동으로 민감한 데이터를 필터링하지만, 클라우드 동기화를 비활성화할 수 있습니다:
```typescript
fixhive_resolve <error-id> "내 해결책" --upload false
```

### SQLite 오류

로컬 데이터베이스 삭제:
```bash
rm -rf .fixhive/
```

### 연결 오류

네트워크와 Supabase 상태 확인:
```bash
curl https://your-project.supabase.co/rest/v1/
```

## 개발

```bash
# 의존성 설치
npm install

# 빌드
npm run build

# 감시 모드
npm run dev

# 타입 검사
npm run typecheck

# 테스트 실행
npm test

# 커버리지와 함께 테스트 실행
npm run test:coverage
```

### 테스트 커버리지

| 모듈 | 커버리지 |
|------|----------|
| Core (error-detector, privacy-filter, hash) | 99% |
| Storage (local-store) | 98% |
| Cloud (client, embedding) | 96% |

## 기여하기

1. 저장소 포크
2. 기능 브랜치 생성 (`git checkout -b feature/amazing`)
3. 변경사항 커밋 (`git commit -m 'Add amazing feature'`)
4. 브랜치에 푸시 (`git push origin feature/amazing`)
5. Pull Request 생성

### 가이드라인

- 새 기능에 테스트 작성
- 기존 코드 스타일 따르기
- 문서 업데이트
- 커밋은 원자적으로 유지

## 변경 로그

릴리스 히스토리는 [CHANGELOG.md](CHANGELOG.md)를 참조하세요.

## 라이선스

MIT - 자세한 내용은 [LICENSE](LICENSE)를 참조하세요.

## 감사의 말

- [OpenCode](https://github.com/opencode-ai/opencode) - AI 코딩 어시스턴트
- [Supabase](https://supabase.com) - Backend as a Service
- [pgvector](https://github.com/pgvector/pgvector) - 벡터 유사도 검색
- [better-sqlite3](https://github.com/WiseLibs/better-sqlite3) - 빠른 SQLite 바인딩
