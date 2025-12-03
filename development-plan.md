# AI Co-Learner 개발 방향성 구현 계획

## 📊 현재 시스템 분석

### 기존 구현 상태
- ✅ 기본 역량 분석 시스템 (6가지 역량: questionQuality, thinkingDepth, creativity, communicationClarity, executionOriented, collaborationSignal)
- ✅ 배치 메시지 분석 (`lambda/message-batch-analyzer/index.mjs`)
- ✅ 역량 집계 시스템 (`lambda/competency-aggregator/index.mjs`)
- ✅ Bot 템플릿 및 사용자별 Bot 관리
- ✅ 채팅 세션 및 메시지 저장
- ⚠️ 초기 역량 진단 기능 없음
- ⚠️ 일일 퀘스트 시스템 없음
- ⚠️ Agent별 특화 역량 추적 없음

---

## 🎯 구현 계획

### **Phase 1: 초기 역량 1차 진단 시스템**

#### 1.1 진단 설문/대화 시스템
**목적**: 신규 사용자의 기초 역량을 파악하여 개인화된 학습 경로 제공

**구현 내용**:
```typescript
// 새로운 타입 정의
interface CompetencyAssessment {
  userId: string;
  assessmentId: string;
  assessmentType: 'initial' | 'periodic';
  status: 'in_progress' | 'completed';
  questions: AssessmentQuestion[];
  results: CompetencyScore[];
  createdAt: number;
  completedAt?: number;
}

interface AssessmentQuestion {
  id: string;
  question: string;
  scenario?: string; // 실제 상황 제시
  expectedCompetencies: string[]; // 이 질문이 평가하는 역량들
}
```

**구체적 단계**:
1. **Initial Assessment Bot 생성**
   - 특별한 시스템 프롬프트를 가진 진단 전용 Bot
   - 8-10개의 개방형 질문/시나리오 제시
   - 사용자 응답을 바탕으로 6가지 역량 초기 점수 산출

2. **프론트엔드 구현**
   - `src/pages/InitialAssessment.tsx` (신규)
   - 온보딩 플로우에 통합
   - 진행률 표시 (1/10, 2/10...)
   - 완료 후 결과 시각화 (Radar Chart)

3. **백엔드 API**
   - `POST /assessment/start` - 진단 시작
   - `POST /assessment/submit-answer` - 각 답변 제출
   - `GET /assessment/results/:userId` - 진단 결과 조회

4. **Lambda 함수**
   - `assessment-analyzer.mjs` - 진단 답변을 Claude로 분석하여 초기 역량 점수 산출

---

### **Phase 2: 역량별 특화 Agent 생성 시스템**

#### 2.1 Agent-Competency 매핑
**목적**: 각 Agent가 특정 역량을 집중 육성

**구현 내용**:
```typescript
// BotTemplate 확장
interface BotTemplate {
  id: string;
  name: string;
  description: string;
  systemPrompt: string;
  themeColor?: string;
  baseType?: string;

  // 새로 추가
  primaryCompetencies: string[];  // 이 봇이 주로 키우는 역량 (1-2개)
  secondaryCompetencies: string[]; // 부가적으로 키우는 역량
  recommendedFor: {  // 추천 대상
    competencyBelow: { [key: string]: number }; // 특정 역량이 N점 이하인 사용자에게 추천
  };
}

// UserBot 확장
interface UserBot {
  id: string;
  userId: string;
  templateId: string;
  name: string;
  currentLevel: number;
  createdAt: string;

  // 새로 추가
  targetCompetencies: string[];  // 사용자가 이 봇으로 키우고자 하는 역량
  competencyProgress: {
    [competency: string]: {
      initialScore: number;
      currentScore: number;
      targetScore: number;
      trend: number; // 최근 변화량
    };
  };
}
```

**구체적 단계**:
1. **추천 시스템**
   - 진단 결과를 바탕으로 약점 역량에 맞는 Agent 추천
   - `src/pages/AgentRecommendation.tsx` (신규)

2. **Agent 생성 시 목표 설정**
   - "이 Agent로 어떤 역량을 키우고 싶으신가요?" 선택 UI
   - 목표 점수 설정 (현재 점수 → 목표 점수)

3. **Dashboard 확장**
   - `src/pages/Dashboard.tsx` 수정
   - 각 Bot 카드에 담당 역량 표시
   - 역량별 성장 추이 그래프 추가

---

### **Phase 3: 일일 퀘스트 시스템**

#### 3.1 Quest 생성 및 관리
**목적**: 매일 개인화된 학습 활동 제공

**구현 내용**:
```typescript
interface DailyQuest {
  questId: string;
  userId: string;
  botId: string;
  questType: 'conversation' | 'challenge' | 'reflection';
  title: string;
  description: string;
  targetCompetency: string;
  difficulty: 'easy' | 'medium' | 'hard';

  // 완료 조건
  completionCriteria: {
    messageCount?: number;
    minScore?: number; // 특정 역량 점수가 이 이상이어야 완료
    keywords?: string[]; // 포함해야 할 키워드
  };

  status: 'pending' | 'in_progress' | 'completed' | 'skipped';
  createdAt: number;
  expiresAt: number; // 24시간 후
  completedAt?: number;

  // 보상
  rewards: {
    xp: number;
    competencyBoost: { [competency: string]: number };
  };
}

interface QuestTemplate {
  id: string;
  competency: string;
  difficulty: string;
  promptTemplate: string; // Claude가 구체적 질문을 생성할 템플릿
}
```

**구체적 단계**:
1. **Quest 생성 Lambda**
   - `quest-generator.mjs` (신규)
   - 매일 오전 9시에 EventBridge로 트리거
   - 각 사용자의 역량 상태를 보고 개인화된 퀘스트 생성
   - Claude API로 흥미로운 질문/시나리오 생성

2. **Quest UI 구현**
   - `src/pages/DailyQuests.tsx` (신규)
   - 오늘의 퀘스트 목록
   - 퀘스트 수락 → 해당 Bot과의 대화방으로 이동
   - 진행률 표시

3. **Quest 완료 감지**
   - `src/components/chat/QuestProgress.tsx` (신규)
   - 채팅 중 퀘스트 진행 상태 실시간 표시
   - 완료 시 축하 애니메이션 + 보상 표시

4. **백엔드 API**
   - `GET /quests/daily/:userId` - 오늘의 퀘스트 조회
   - `POST /quests/accept/:questId` - 퀘스트 수락
   - `POST /quests/complete/:questId` - 퀘스트 완료 확인

---

### **Phase 4: 역량 성장 추적 및 시각화**

#### 4.1 세밀한 추적 시스템
**목적**: Agent별, 역량별 성장을 명확히 보여줌

**구현 내용**:
```typescript
interface CompetencyTimeline {
  userId: string;
  competency: string;
  dataPoints: {
    timestamp: number;
    score: number;
    source: 'chat' | 'quest' | 'assessment';
    botId?: string; // 어느 봇과의 대화에서 얻은 점수인지
    questId?: string;
  }[];
}

interface BotCompetencyContribution {
  botId: string;
  competency: string;
  totalContribution: number; // 이 봇이 해당 역량에 기여한 총점
  averageScore: number;
  sessionCount: number;
  lastActive: number;
}
```

**구체적 단계**:
1. **역량 집계 강화**
   - `lambda/competency-aggregator/index.mjs` 수정
   - Bot별 기여도 계산 추가
   - 주간/월간 변화량 계산

2. **시각화 컴포넌트**
   - `src/components/dashboard/CompetencyGrowthChart.tsx` (신규)
   - 시계열 그래프 (recharts 사용)
   - Bot별 색상 구분
   - 퀘스트 완료 시점 마커

3. **Agent별 상세 페이지**
   - `src/pages/BotDetail.tsx` (신규)
   - 이 Bot과의 대화 통계
   - 이 Bot으로 키운 역량 상세 분석
   - 추천 다음 목표

---

### **Phase 5: 동기부여 시스템**

#### 5.1 레벨업 및 보상
**구현 내용**:
```typescript
interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  condition: {
    type: 'competency_reach' | 'quest_complete' | 'streak' | 'bot_level';
    target: any;
  };
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  unlockedAt?: number;
}

interface UserStreak {
  userId: string;
  currentStreak: number; // 연속 활동 일수
  longestStreak: number;
  lastActiveDate: string; // YYYY-MM-DD
}
```

**구체적 단계**:
1. **업적 시스템**
   - `src/pages/Achievements.tsx` (신규)
   - 다양한 업적 정의 (예: "질문 마스터", "연속 7일 학습" 등)
   - 잠금 해제 애니메이션

2. **스트릭 추적**
   - 연속 학습 일수 표시
   - 스트릭 유지 알림

3. **레벨업 시스템**
   - Bot 레벨업 조건 명확화 (역량 성장 + 대화 횟수)
   - 레벨업 시 특별 보상

---

## 📅 구현 우선순위

### 🔥 High Priority (1-2주)
1. **Phase 1: 초기 역량 진단** - 가장 기초적이고 필수적
2. **Phase 2: Agent-Competency 매핑** - 기존 Bot 시스템 확장

### 🟡 Medium Priority (3-4주)
3. **Phase 3: 일일 퀘스트** - 핵심 참여 동력
4. **Phase 4: 성장 추적** - 가시적 피드백

### 🟢 Low Priority (5-6주)
5. **Phase 5: 동기부여 시스템** - 장기 리텐션

---

## 🏗️ 기술적 구현 세부사항

### 데이터베이스 테이블 추가
1. **ai-co-learner-assessments** - 진단 데이터
2. **ai-co-learner-daily-quests** - 퀘스트 데이터
3. **ai-co-learner-competency-timeline** - 역량 변화 이력
4. **ai-co-learner-achievements** - 업적 데이터

### Lambda 함수 추가
1. **assessment-analyzer** - 진단 분석
2. **quest-generator** - 매일 퀘스트 생성
3. **quest-evaluator** - 퀘스트 완료 여부 판정
4. **achievement-tracker** - 업적 달성 체크

### API 엔드포인트 추가 (`lambda/chat-api/index.mjs`)
```javascript
// Assessment
POST /assessment/start
POST /assessment/submit-answer
GET /assessment/results/:userId

// Quest
GET /quests/daily/:userId
POST /quests/accept/:questId
POST /quests/complete/:questId

// Bot Detail
GET /bots/:botId/statistics
GET /bots/:botId/competency-contribution

// Achievements
GET /achievements/:userId
POST /achievements/claim/:achievementId
```

---

## 💡 핵심 차별화 포인트

1. **개인화된 학습 경로**: 초기 진단 → 맞춤 Agent 추천 → 일일 맞춤 퀘스트
2. **명확한 성장 가시화**: Agent별로 어떤 역량이 얼마나 성장했는지 명확히 표시
3. **의도적 제약을 통한 성장**: 각 Agent의 특수한 대화 방식이 특정 역량을 자연스럽게 키움
4. **지속 가능한 동기부여**: 퀘스트, 스트릭, 업적 등 다층적 보상 시스템

---

## 📝 다음 단계

이 계획대로 진행하시면 4-6주 안에 완전한 "개인화 학습 코칭 플랫폼"이 완성됩니다.

### 시작 권장 순서
1. Phase 1 (초기 역량 진단) 구현
2. Phase 2 (Agent-Competency 매핑) 통합
3. Phase 3 (일일 퀘스트) 추가
4. Phase 4 (성장 추적) 강화
5. Phase 5 (동기부여) 완성

각 Phase별로 MVP를 먼저 만들고, 사용자 피드백을 받으며 개선하는 방식을 추천합니다.
