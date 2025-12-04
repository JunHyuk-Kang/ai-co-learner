# AI Co-Learner 개발 로드맵

## 현재 구현 상태 (2025-11-27)

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

---

## 🎯 다음 단계: Phase 3-5

### Phase 3: 초기 역량 진단 시스템 (우선순위 High)
**목표**: 신규 사용자의 기초 역량 파악 및 개인화 학습 경로 제공

**구현 내용**:
1. **진단 전용 Bot 생성**
   - 8-10개 개방형 질문/시나리오 제시
   - 사용자 응답 기반 초기 역량 점수 산출

2. **프론트엔드**
   - `InitialAssessment.tsx` 페이지 생성
   - 온보딩 플로우 통합
   - 결과 시각화 (Radar Chart)

3. **백엔드 API**
   - `POST /assessment/start` - 진단 시작
   - `POST /assessment/submit-answer` - 답변 제출
   - `GET /assessment/results/:userId` - 결과 조회

4. **DynamoDB 테이블**
   - `ai-co-learner-assessments` 생성

5. **Lambda 함수**
   - `assessment-analyzer` - 진단 답변 분석

---

### Phase 4: Agent-Competency 매핑 시스템
**목표**: 각 Agent가 특정 역량을 집중 육성

**구현 내용**:
1. **BotTemplate 확장**
   ```javascript
   {
     primaryCompetencies: ["creativity", "thinkingDepth"],
     secondaryCompetencies: ["questionQuality"],
     recommendedFor: {
       competencyBelow: { creativity: 70 }
     }
   }
   ```

2. **추천 시스템**
   - 진단 결과 기반 약점 역량 파악
   - 맞춤 Agent 추천 UI

3. **Dashboard 확장**
   - Agent별 담당 역량 표시
   - 역량별 성장 추이 그래프

---

### Phase 5: 일일 퀘스트 시스템 (참여 동력)
**목표**: 매일 개인화된 학습 활동 제공

**구현 내용**:
1. **DynamoDB 테이블**
   - `ai-co-learner-daily-quests`

2. **Lambda 함수**
   - `quest-generator` (EventBridge: 매일 오전 9시)
   - `quest-evaluator` (완료 여부 판정)

3. **Quest 타입**
   ```javascript
   {
     questType: 'conversation' | 'challenge' | 'reflection',
     targetCompetency: 'creativity',
     difficulty: 'easy' | 'medium' | 'hard',
     completionCriteria: {
       messageCount: 5,
       minScore: 80
     },
     rewards: {
       xp: 100,
       competencyBoost: { creativity: 5 }
     }
   }
   ```

4. **프론트엔드**
   - `DailyQuests.tsx` 페이지
   - 진행률 표시 및 완료 애니메이션

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

### 🔥 High Priority (1-2주)
1. **Phase 3: 초기 역량 진단** - 개인화 기반
2. **Phase 4: Agent-Competency 매핑** - 맞춤 추천

### 🟡 Medium Priority (3-4주)
3. **Phase 5: 일일 퀘스트** - 참여 동력
4. **역량 성장 시각화** - 대시보드 강화

### 🟢 Low Priority (5-6주)
5. **배지/업적 시스템** - 장기 리텐션
6. **고급 분석** (머신러닝 기반)

---

## 📂 참고 문서

상세 구현 내용은 `docs/archive/` 참조:
- `total_development-plan.md` - 배치 분석 시스템 상세 가이드
- `data-strategy.md` - 데이터 전략 및 비용 분석
- `ai-analysis-implementation.md` - AI 분석 구현 가이드
- `development-plan.md` - Phase 1-5 상세 계획

---

**최종 업데이트**: 2025-11-27
