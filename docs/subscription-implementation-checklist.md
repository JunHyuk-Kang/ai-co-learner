# 구독 시스템 구현 체크리스트

**작성일:** 2026-01-15
**목표:** 4가지 티어 구독 시스템 구현 (FREE, TRIAL, PREMIUM, UNLIMITED)

---

## ✅ Phase 1: TypeScript 타입 정의 (완료)

- [x] `src/types.ts`에 `SubscriptionTier` enum 추가
- [x] `MessageQuota` 인터페이스 추가
- [x] `TrialPeriod` 인터페이스 추가
- [x] `SubscriptionMetadata` 인터페이스 추가
- [x] `TierConfig` 및 `TIER_CONFIGS` 상수 추가
- [x] `User` 인터페이스에 구독 필드 추가
- [x] `QuotaExceededError`, `TrialExpiredError` 타입 추가

**검증 방법:**
```bash
# types.ts 파일 확인
grep -n "SubscriptionTier" src/types.ts
grep -n "MessageQuota" src/types.ts
```

---

## ✅ Phase 2: Lambda chat-api 백엔드 (완료)

### 2.1 Quota 체크 로직
- [x] `sendChatMessageStream()` 함수에 사용자 조회 추가 (line ~510)
- [x] TRIAL 티어 체험 기간 만료 체크 (line ~540)
- [x] 메시지 할당량 초과 체크 (line ~564)
- [x] 메시지 전송 성공 후 usage 증가 로직 (line ~752)
- [x] 월 자동 리셋 로직 포함

### 2.2 관리자 엔드포인트 라우팅
- [x] `/admin/subscription/update-tier` 라우팅 추가 (line ~226)
- [x] `/admin/subscription/reset-quota` 라우팅 추가
- [x] `/admin/subscription/extend-trial` 라우팅 추가
- [x] `/admin/subscription/stats` 라우팅 추가

### 2.3 구독 관리 함수 작성
- [x] `subscription-functions.mjs` 파일 생성
- [x] `updateSubscriptionTier()` 함수 작성
- [x] `resetUserQuota()` 함수 작성
- [x] `extendTrialPeriod()` 함수 작성
- [x] `getSubscriptionStats()` 함수 작성

**검증 방법:**
```bash
# Lambda 파일 확인
grep -n "subscriptionTier" lambda/chat-api/index.mjs
grep -n "messageQuota" lambda/chat-api/index.mjs
grep -n "QUOTA_EXCEEDED" lambda/chat-api/index.mjs

# 구독 함수 파일 존재 확인
ls lambda/chat-api/subscription-functions.mjs
```

---

## 🔄 Phase 3: Lambda 배포 (진행 예정)

### 3.1 함수 병합
- [ ] `subscription-functions.mjs` 내용을 `index.mjs` 끝에 복사
- [ ] `index.mjs` 파일 저장 확인
- [ ] 문법 오류 없는지 확인

### 3.2 배포 실행
- [ ] `cd lambda/chat-api` 이동
- [ ] `npm install` 실행 (의존성 확인)
- [ ] `deploy.bat` 실행 (Windows) 또는 `./deploy.sh` (Linux/Mac)
- [ ] 배포 성공 메시지 확인

### 3.3 배포 검증
- [ ] AWS Lambda 콘솔에서 함수 크기 확인 (예상: ~8-9MB)
- [ ] CloudWatch Logs에서 에러 없는지 확인
- [ ] API Gateway 엔드포인트 테스트

**검증 방법:**
```bash
# Lambda 함수 확인
aws lambda get-function --function-name ai-co-learner-chat --region ap-northeast-2

# 최근 로그 확인
aws logs tail /aws/lambda/ai-co-learner-chat --since 5m --region ap-northeast-2
```

---

## 🔄 Phase 4: 프론트엔드 UI 구현 (진행 예정)

### 4.1 awsBackend.ts API 함수 추가
- [ ] `updateUserSubscriptionTier()` 함수 추가
- [ ] `resetUserQuota()` 함수 추가
- [ ] `extendUserTrial()` 함수 추가
- [ ] `getSubscriptionStats()` 함수 추가
- [ ] `getUserSubscription()` 함수 추가 (사용자용)

### 4.2 AdminPanel - 구독 관리 탭
- [ ] `view` state에 'subscriptions' 추가
- [ ] 구독 관리 탭 버튼 추가 (CreditCard 아이콘)
- [ ] `<SubscriptionManagement>` 컴포넌트 생성
- [ ] 티어 분포 차트 (Pie Chart)
- [ ] 사용자 구독 테이블 (tier, quota, trial status)
- [ ] 티어 변경 모달
- [ ] 할당량 리셋 버튼
- [ ] 체험 연장 모달

### 4.3 ChatRoom - Quota 표시
- [ ] 헤더에 남은 메시지 표시 (UNLIMITED 제외)
- [ ] quota 초과 시 입력창 비활성화
- [ ] `QuotaExceededModal` 컴포넌트 생성
- [ ] `TrialExpiredModal` 컴포넌트 생성
- [ ] 에러 핸들링 (QUOTA_EXCEEDED, TRIAL_EXPIRED)

### 4.4 Dashboard - 구독 정보 위젯
- [ ] 구독 정보 카드 추가 (왼쪽 컬럼)
- [ ] 티어 뱃지 표시 (색상별)
- [ ] Quota 진행률 바 (ProgressBar)
- [ ] 체험 기간 카운트다운 (TRIAL만)
- [ ] 업그레이드 버튼 (FREE/TRIAL/PREMIUM)

### 4.5 UpgradePage 생성
- [ ] `src/pages/UpgradePage.tsx` 파일 생성
- [ ] 3가지 티어 비교 테이블
- [ ] 각 티어별 기능 리스트
- [ ] 가격 정보 표시
- [ ] 업그레이드 CTA 버튼
- [ ] Router에 `/upgrade` 경로 추가

**검증 방법:**
```bash
# 파일 존재 확인
ls src/services/awsBackend.ts
ls src/pages/UpgradePage.tsx

# 컴포넌트 import 확인
grep -n "SubscriptionTier" src/pages/AdminPanel.tsx
grep -n "messageQuota" src/pages/ChatRoom.tsx
```

---

## 🔄 Phase 5: 마이그레이션 (진행 예정)

### 5.1 마이그레이션 스크립트 작성
- [ ] `scripts/migrate-users-to-subscription.mjs` 파일 생성
- [ ] 기존 사용자 조회 (DynamoDB Scan)
- [ ] `subscriptionTier = 'UNLIMITED'` 설정
- [ ] `messageQuota` 초기화 (monthlyLimit: -1)
- [ ] Dry-run 모드 구현 (실제 업데이트 전 확인)

### 5.2 마이그레이션 실행
- [ ] Dry-run 실행하여 대상 사용자 확인
- [ ] DynamoDB 백업 (선택사항)
- [ ] 프로덕션 마이그레이션 실행
- [ ] 로그 확인 (성공/실패 수)

**검증 방법:**
```bash
# 마이그레이션 실행 (Dry-run)
node scripts/migrate-users-to-subscription.mjs --dry-run

# 실제 실행
node scripts/migrate-users-to-subscription.mjs

# DynamoDB 데이터 확인
aws dynamodb scan --table-name ai-co-learner-users --max-items 5 --region ap-northeast-2
```

---

## 🔄 Phase 6: 테스트 (진행 예정)

### 6.1 백엔드 API 테스트
- [ ] FREE 사용자 생성 → 50개 메시지 전송 → quota 초과 확인
- [ ] TRIAL 사용자 생성 → 30일 후 만료 확인
- [ ] PREMIUM 사용자 생성 → 1500개 메시지 전송 → quota 초과 확인
- [ ] UNLIMITED 사용자 → 무제한 메시지 확인
- [ ] Admin 티어 변경 API 테스트
- [ ] Admin quota 리셋 API 테스트
- [ ] Admin 체험 연장 API 테스트
- [ ] Admin 구독 통계 API 테스트

### 6.2 프론트엔드 UI 테스트
- [ ] AdminPanel 구독 탭 렌더링 확인
- [ ] 티어 변경 모달 동작 확인
- [ ] ChatRoom quota 표시 확인
- [ ] ChatRoom quota 초과 시 입력창 비활성화 확인
- [ ] Dashboard 구독 위젯 표시 확인
- [ ] UpgradePage 렌더링 확인

### 6.3 E2E 시나리오 테스트
- [ ] **시나리오 1:** FREE 사용자 → 50개 메시지 → quota 초과 → 업그레이드
- [ ] **시나리오 2:** TRIAL 사용자 → 1000개 메시지 → 30일 후 만료 → 업그레이드
- [ ] **시나리오 3:** Admin이 사용자 티어 변경 → 즉시 반영 확인
- [ ] **시나리오 4:** 월 자동 리셋 (다음 달 1일)

**검증 방법:**
```bash
# 테스트 실행
npm test

# E2E 테스트
npm run test:e2e
```

---

## 📋 전체 진행 상황

| Phase | 작업 | 상태 | 완료일 |
|-------|------|------|--------|
| 1 | TypeScript 타입 정의 | ✅ 완료 | 2026-01-15 |
| 2 | Lambda 백엔드 수정 | ✅ 완료 | 2026-01-15 |
| 3 | Lambda 배포 | 🔄 진행 예정 | - |
| 4 | 프론트엔드 UI 구현 | 🔄 진행 예정 | - |
| 5 | 마이그레이션 | 🔄 진행 예정 | - |
| 6 | 테스트 | 🔄 진행 예정 | - |

---

## 🚨 중요 체크포인트

### Lambda 배포 전 확인사항
1. ✅ `subscription-functions.mjs` → `index.mjs` 병합 완료
2. ✅ 문법 오류 없음 (ESLint 통과)
3. ✅ CORS 헤더 모든 응답에 포함
4. ✅ 환경 변수 설정 확인 (`GEMINI_API_KEY`, 테이블 이름 등)

### 프론트엔드 배포 전 확인사항
1. ✅ Lambda API 배포 완료
2. ✅ TypeScript 빌드 성공 (`npm run build`)
3. ✅ ESLint 에러 없음 (`npm run lint`)
4. ✅ 테스트 통과 (`npm test`)

### 프로덕션 배포 전 확인사항
1. ✅ 마이그레이션 Dry-run 실행 완료
2. ✅ 기존 사용자 UNLIMITED 티어 확인
3. ✅ E2E 테스트 전체 통과
4. ✅ CloudWatch 로그 에러 없음

---

## 📝 빠른 명령어 모음

```bash
# Lambda 배포
cd lambda/chat-api
npm install
deploy.bat  # Windows
./deploy.sh  # Linux/Mac

# 프론트엔드 빌드
npm run build
npm run lint
npm test

# 프론트엔드 배포 (S3)
npm run deploy

# 마이그레이션
node scripts/migrate-users-to-subscription.mjs --dry-run
node scripts/migrate-users-to-subscription.mjs

# 로그 확인
aws logs tail /aws/lambda/ai-co-learner-chat --since 10m --region ap-northeast-2

# DynamoDB 데이터 확인
aws dynamodb scan --table-name ai-co-learner-users --max-items 5 --region ap-northeast-2
```

---

## 🔗 관련 문서

- [CLAUDE.md](../CLAUDE.md) - 프로젝트 전체 가이드
- [API 에러 응답 가이드](./api-error-responses.md)
- [Lambda 환경 변수 가이드](./lambda-environment-variables.md)
- [개발 로드맵](./development-roadmap.md)

---

**마지막 업데이트:** 2026-01-15
**다음 단계:** Phase 3 - Lambda 배포
