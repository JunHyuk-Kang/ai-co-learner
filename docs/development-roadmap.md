# AI Co-Learner 개발 로드맵

## 현재 구현 상태 (2025-12-08)

### ✅ Phase 1 완료: AWS 서버리스 인프라 구축
- AWS Cognito 사용자 인증
- DynamoDB 테이블 4개 (users, user-bots, chat-sessions, bot-templates)
- Lambda 함수 (chat-api)
- API Gateway REST API
- S3 + CloudFront 프론트엔드 배포
- Bedrock AI 모델 (Llama 3.2 3B)

### ✅ Phase 2 완료: 배치 메시지 분석 시스템
- DynamoDB 테이블 추가 (learning-analytics, user-competencies)
- Lambda 함수 추가 (message-batch-analyzer, competency-aggregator)
- EventBridge 스케줄러 (5분/일일)
- TTL 설정 (채팅 30일, 분석 데이터 1년)
- 역량 6가지 자동 분석: questionQuality, thinkingDepth, creativity, communicationClarity, executionOriented, collaborationSignal

### ✅ Phase 3 완료: 초기 역량 진단 시스템 (2025-12-05)
- DynamoDB 테이블 추가 (assessments)
- Lambda 함수: assessment-analyzer (chat-api 통합)
- API 엔드포인트 3개 추가
  - `POST /assessment/start` - 진단 시작
  - `POST /assessment/submit` - 답변 제출
  - `GET /assessment/results/:userId` - 결과 조회
- 프론트엔드: InitialAssessment.tsx 페이지 완성
- 8개 개방형 질문 기반 역량 진단
- Claude Haiku를 통한 실시간 답변 분석
- 6가지 역량 점수 자동 산출 (1-10점 → 10-100점)
- 결과 시각화 및 user-competencies 테이블 저장

### ✅ Phase 4 완료: Agent-Competency 매핑 시스템 (2025-12-05)
- BotTemplate 스키마 확장 (primaryCompetencies, secondaryCompetencies, recommendedFor)
- 기존 봇 템플릿에 역량 데이터 추가 (t2: 셜록, t3: 다빈치)
- 추천 알고리즘 구현: `GET /bots/recommended/:userId`
- Dashboard에 "당신을 위한 추천 봇" 섹션 추가
- 모든 봇 카드에 담당 역량 태그 표시
- 역량 기반 맞춤형 봇 추천 시스템 완성

### ✅ Phase 5 완료: 일일 퀘스트 시스템 (2025-12-08)
- DynamoDB 테이블: `ai-co-learner-daily-quests` (7일 TTL)
- Lambda 함수 2개:
  - `quest-generator`: 매일 9시 KST 자동 생성 (역량 기반 맞춤형)
  - `quest-evaluator`: 5분마다 진행률 체크 및 보상 지급
- Quest 타입 3가지: conversation, challenge, reflection
- 보상 시스템: XP + 역량 부스트
- 프론트엔드: `DailyQuests.tsx` 페이지 (진행률 실시간 표시)
- API 엔드포인트: `GET /quests/:userId`

### ✅ Phase 6 완료: 배지/업적 시스템 (2025-12-08)
- DynamoDB 테이블: `ai-co-learner-user-achievements`
- Lambda 함수: `achievement-evaluator` (5분마다 자동 평가)
- 14개 배지 구현:
  - 마일스톤 3개 (First Steps, Chatty Learner, Conversation Master)
  - 퀘스트 3개 (Quest Starter, Quest Warrior, Quest Legend)
  - 역량 6개 (Question King, Deep Thinker, Creative Genius, Great Communicator, Action Taker, Team Player)
  - 연속활동 2개 (Week Warrior, Month Master)
- Dashboard 배지 섹션: 획득/미획득 배지 표시, 진행률 바
- API 엔드포인트: `GET /achievements/:userId`

### ✅ Phase 7 완료: 학습 패턴 분석 시스템 (2025-12-08)
- Lambda 함수: `learning-pattern-analyzer`
- 분석 기능:
  - 강점/약점 자동 식별 (평균 대비 10점 기준)
  - 학습 활동 패턴 분석 (시간대, 요일별, 메시지 길이)
  - 성장 추세 분석 (30일 기준)
  - 개인화된 인사이트 자동 생성 (5가지 유형)
- 인사이트 유형: 강점 활용, 약점 개선, 성장 추세, 학습 패턴, 역량 급상승
- 프론트엔드: `LearningInsights.tsx` 컴포넌트 (Dashboard 통합)
- API 엔드포인트: `GET /analysis/:userId`

---

## 🎯 다음 단계: Phase 8 이후

### Phase 8: 추천 알고리즘 고도화 (우선순위: 높음)

#### ✅ 8-1. 학습 패턴 기반 봇 추천 (2025-12-09)
**목표**: 단순 역량 부족 기반에서 → 학습 패턴/선호도 기반 추천

**구현 내용**:
- learning-pattern-analyzer에 봇 선호도 분석 추가
  - 선호 봇 타입 분석 (baseType별 사용 빈도)
  - 대화 길이 패턴 (짧은 vs 긴 대화)
  - 주제 선호도 (primaryCompetencies 사용 빈도)
- 학습 시간대에 맞는 봇 추천 (아침형/저녁형)
- 추천 API 개선: `GET /bots/recommended/:userId?mode=pattern`

**예상 작업 시간**: 2-3시간

#### 8-2. 퀘스트 난이도 자동 조정
**목표**: 사용자 수준에 맞는 적응형 퀘스트

**구현 내용**:
- quest-generator 개선:
  - 최근 7일 퀘스트 완료율 계산
  - 완료율 < 30%: 난이도 하향 (메시지 수 감소, 목표 점수 하향)
  - 완료율 > 80%: 난이도 상향 (메시지 수 증가, 목표 점수 상향)
  - 역량 점수 변화율 반영 (빠르게 성장 중이면 난이도 상승)
- DynamoDB에 난이도 히스토리 저장

**예상 작업 시간**: 1-2시간

---

### Phase 9: UX/성능 개선 (우선순위: 중간)

#### 9-1. 배지 획득 알림 시스템
- 배지 획득 시 Dashboard 토스트 알림
- 축하 애니메이션 효과
- 배지 상세 정보 모달

**예상 작업 시간**: 1-2시간

#### 9-2. 학습 시간 통계 대시보드
- 주간/월간 학습 시간 그래프
- 요일별 활동 히트맵 (Calendar Heatmap)
- 연속 학습일 스트릭 표시

**예상 작업 시간**: 3-4시간

#### 9-3. 역량 비교 차트
- 평균 대비 내 역량 비교 (백분위)
- 목표 설정 기능
- 역량별 상세 분석 페이지

**예상 작업 시간**: 2-3시간

---

### Phase 10: AI 기능 강화 (우선순위: 중간)

#### 10-1. 주간 학습 리포트
- Lambda 함수: `weekly-report-generator`
- EventBridge: 매주 일요일 자동 생성
- SES 이메일 발송 or Dashboard 알림
- 내용: 주간 학습 시간, 역량 변화, 달성한 배지, 다음 주 추천 활동

**예상 작업 시간**: 3-4시간

#### 10-2. 맞춤형 학습 경로 제안
- 약점 극복을 위한 구체적 액션 플랜
- 단계별 학습 로드맵 생성
- 추천 봇 순서 제안

**예상 작업 시간**: 4-5시간

---

### Phase 11: 소셜 기능 (우선순위: 낮음 - 사용자 요청 시)
- 친구 시스템
- 리더보드
- 학습 그룹

---

### Phase 12: 모니터링 및 보안 (우선순위: 높음)

#### 12-1. 보안 강화
- [ ] API Gateway Rate Limiting 추가
- [ ] Lambda 함수 권한 최소화 (Least Privilege)
- [ ] DynamoDB 암호화 설정 검토
- [ ] CORS 정책 세밀화

**예상 작업 시간**: 2-3시간

#### 12-2. 모니터링 대시보드
- [ ] CloudWatch 대시보드 구축
- [ ] 에러 로그 자동 알림 (SNS)
- [ ] Lambda 성능 메트릭 추적

**예상 작업 시간**: 2-3시간

---

## 📊 데이터 전략 요약

### 2단계 데이터 보관
1. **채팅 데이터** (`chat-sessions`)
   - 30일 TTL
   - 용도: 최근 대화 확인, 컨텍스트 유지

2. **분석 데이터** (`learning-analytics`)
   - 1년 TTL
   - 용도: 역량 계산, 장기 학습 패턴 분석

### 배치 분석 흐름
```
사용자 메시지 전송
    ↓
chat-sessions 저장 (30일 TTL)
    ↓
즉시 응답 반환
    ↓
[5분마다 EventBridge 트리거]
    ↓
최근 5분 메시지 조회 (10-50개)
    ↓
Claude API 배치 분석 (1회 호출)
    ↓
learning-analytics 저장 (1년 TTL)
    ↓
[1일 1회 집계]
    ↓
역량 점수 업데이트
```

### 비용 최적화
- 배치 분석으로 API 호출 90% 감소
- TTL로 DynamoDB 저장 비용 80% 절감
- 예상 비용: 월 $28 (메시지 10만 개 기준)

---

## 🚀 구현 우선순위

### ✅ Completed (2025-12-08)
1. ~~**Phase 1-2: 인프라 + 배치 분석**~~ - 완료
2. ~~**Phase 3: 초기 역량 진단**~~ - 완료
3. ~~**Phase 4: Agent-Competency 매핑**~~ - 완료
4. ~~**Phase 5: 일일 퀘스트**~~ - 완료
5. ~~**Phase 6: 배지/업적 시스템**~~ - 완료
6. ~~**Phase 7: 학습 패턴 분석**~~ - 완료

### 🔴 High Priority (즉시 구현 가능)
- **Phase 8-1: 학습 패턴 기반 봇 추천** (2-3시간)
- **Phase 8-2: 퀘스트 난이도 자동 조정** (1-2시간)
- **Phase 12-1: 보안 강화** (2-3시간)

### 🟡 Medium Priority (단기 계획)
- **Phase 9-1: 배지 획득 알림** (1-2시간)
- **Phase 9-2: 학습 시간 통계** (3-4시간)
- **Phase 10-1: 주간 리포트** (3-4시간)

### 🟢 Low Priority (장기 계획)
- **Phase 9-3: 역량 비교 차트** (2-3시간)
- **Phase 10-2: 맞춤형 학습 경로** (4-5시간)
- **Phase 11: 소셜 기능** (사용자 요청 시)

---

## 📂 참고 문서

상세 구현 내용은 `docs/archive/` 참조:
- `total_development-plan.md` - 배치 분석 시스템 상세 가이드
- `data-strategy.md` - 데이터 전략 및 비용 분석
- `ai-analysis-implementation.md` - AI 분석 구현 가이드
- `development-plan.md` - Phase 1-5 상세 계획

---

---

## 📈 프로젝트 현황 요약

| 구분 | 개수 | 상태 |
|------|------|------|
| **완료된 Phase** | 7개 | ✅ |
| **Lambda 함수** | 7개 | 배포 완료 |
| **DynamoDB 테이블** | 9개 | 운영 중 |
| **Frontend 페이지** | 6개 | 배포 완료 |
| **API 엔드포인트** | 20+ | 통합 완료 |

### Lambda 함수 목록
1. `ai-co-learner-chat` - 채팅 + 라우팅
2. `message-batch-analyzer` - 메시지 분석 (5분)
3. `competency-aggregator` - 역량 집계 (1일)
4. `quest-generator` - 퀘스트 생성 (1일)
5. `quest-evaluator` - 퀘스트 평가 (5분)
6. `achievement-evaluator` - 배지 평가 (5분)
7. `learning-pattern-analyzer` - 학습 분석 (on-demand)

### DynamoDB 테이블 목록
1. `ai-co-learner-users`
2. `ai-co-learner-user-bots`
3. `ai-co-learner-bot-templates`
4. `ai-co-learner-chat-sessions` (30일 TTL)
5. `ai-co-learner-learning-analytics` (1년 TTL)
6. `ai-co-learner-user-competencies`
7. `ai-co-learner-daily-quests` (7일 TTL)
8. `ai-co-learner-assessments`
9. `ai-co-learner-user-achievements`

---

**최종 업데이트**: 2025-12-08
