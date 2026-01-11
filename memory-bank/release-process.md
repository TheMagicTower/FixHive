# FixHive 릴리즈 프로세스

## 중요: npm 릴리즈는 GitHub Actions에서만 수행

**절대로 터미널에서 `npm publish`를 직접 실행하지 말 것!**

### 올바른 릴리즈 순서

1. 코드 변경 완료 및 커밋
2. `npm version patch|minor|major` 실행 (버전 범프 + 태그 생성)
3. `git push origin main` 실행
4. `git push origin v0.x.x` 태그 푸시
5. **GitHub Actions가 자동으로 npm publish 수행**
6. `gh release create v0.x.x ...` GitHub 릴리즈 생성

### 하지 말아야 할 것

- ❌ `npm publish --access public` 직접 실행
- ❌ GitHub Actions 실행 전에 수동 배포

### 이유

- 터미널에서 먼저 npm publish하면 GitHub Actions의 "Publish to npm" 단계가 실패함
- 버전이 이미 존재하면 duplicate version 에러 발생
- CI/CD 파이프라인 일관성 유지
