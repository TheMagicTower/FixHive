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

> OpenCode를 위한 커뮤니티 기반 오류 지식 공유 시스템

FixHive는 개발 세션 중 발생하는 오류를 자동으로 캡처하고, 커뮤니티 지식 베이스에서 솔루션을 검색하며, 해결된 오류를 다른 개발자들과 공유하는 OpenCode 플러그인입니다.

## 주요 기능

- **자동 오류 감지**: 도구 출력(bash, edit 등)에서 오류를 자동으로 감지
- **클라우드 지식 베이스**: 시맨틱 유사도(pgvector)를 사용한 커뮤니티 솔루션 검색
- **로컬 캐싱**: 오프라인 접근을 위한 SQLite 기반 로컬 저장소
- **개인정보 필터링**: 민감한 데이터(API 키, 경로, 이메일) 자동 삭제
- **실시간 동기화**: 오류/해결 시 즉각적인 클라우드 통신

## 설치

```bash
npm install @the-magic-tower/fixhive-opencode-plugin
```

## 설정

다음 환경 변수를 설정하세요:

```bash
# 클라우드 기능 필수
FIXHIVE_SUPABASE_URL=https://your-project.supabase.co
FIXHIVE_SUPABASE_KEY=your-anon-key

# 선택: 임베딩 기반 시맨틱 검색용
OPENAI_API_KEY=sk-...

# 선택: 사용자 정의 기여자 ID (미설정시 자동 생성)
FIXHIVE_CONTRIBUTOR_ID=your-contributor-id
```

## 사용법

### OpenCode 플러그인으로 사용

OpenCode 설정 파일(`opencode.config.ts`)에 추가:

```typescript
import FixHivePlugin from '@the-magic-tower/fixhive-opencode-plugin';

export default {
  plugins: [FixHivePlugin],
};
```

### 사용 가능한 명령어

| 명령어 | 설명 |
|--------|------|
| `fixhive_search` | 오류 솔루션 지식 베이스 검색 |
| `fixhive_resolve` | 오류를 해결됨으로 표시하고 솔루션 공유 |
| `fixhive_list` | 현재 세션의 오류 목록 조회 |
| `fixhive_vote` | 솔루션 추천/비추천 |
| `fixhive_stats` | 사용 통계 조회 |
| `fixhive_helpful` | 솔루션이 도움됐음을 보고 |

### 사용 예시 워크플로우

1. **오류 발생** → FixHive가 자동으로 감지하고 기록
2. **솔루션 검색** → `fixhive_search "Module not found: react"`
3. **수정 적용** → 커뮤니티 솔루션 따라하기
4. **해결 공유** → `fixhive_resolve <error-id> "누락된 의존성 설치"`

## 클라우드 설정 (Supabase)

1. 새 Supabase 프로젝트 생성
2. SQL 에디터에서 설정 스크립트 실행:

```bash
cat scripts/setup-supabase.sql | pbcopy
# Supabase SQL 에디터에 붙여넣기
```

3. Settings > API에서 프로젝트 URL과 anon key 획득

## 아키텍처

```
FixHive Plugin
├── Error Detection (tool.execute.after 훅)
├── Privacy Filter (민감한 데이터 삭제)
├── Local Storage (SQLite)
│   ├── error_records
│   └── query_cache
└── Cloud Client (Supabase + pgvector)
    ├── knowledge_entries
    └── usage_logs
```

## 개인정보 보호

FixHive는 민감한 정보를 자동으로 필터링합니다:

- API 키 (OpenAI, GitHub, AWS, Stripe 등)
- JWT 토큰 및 Bearer 토큰
- 이메일 주소
- 파일 경로 (`~` 또는 `<PROJECT>`로 대체)
- 민감한 이름의 환경 변수
- 데이터베이스 연결 문자열
- IP 주소 (localhost 제외)

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
```

## 라이선스

MIT

## 기여하기

1. 저장소 포크
2. 기능 브랜치 생성
3. 변경 사항 커밋
4. 브랜치에 푸시
5. Pull Request 생성
