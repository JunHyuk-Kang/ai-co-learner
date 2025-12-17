# Admin 봇 추천 관리 가이드

## 개요

이제 Admin이 **역량별 봇 추천 규칙을 동적으로 관리**할 수 있습니다. 더 이상 초기 5개 봇에만 국한되지 않고, 새로운 봇을 생성하거나 기존 봇의 추천 조건을 자유롭게 수정할 수 있습니다.

---

## 주요 기능

### 1. 봇 템플릿 생성/수정 시 추천 설정

Admin Panel에서 봇 템플릿을 생성하거나 수정할 때 다음을 설정할 수 있습니다:

#### **기본 정보**
- **이름**: 봇의 이름 (예: "창의력 마스터")
- **설명**: 봇의 간단한 설명
- **Theme Color**: 봇의 테마 색상 (Blue, Purple, Green, Orange, Pink, Red, Teal)
- **Base Type**: 봇의 기본 유형 (Coaching, Questioning, Reflective, Supportive)
- **System Prompt**: 봇의 핵심 로직 (AI 행동 지침)

#### **역량 설정**
- **주요 육성 역량 (Primary Competencies)**: 이 봇이 주로 키워주는 역량 (복수 선택 가능)
- **부차적 육성 역량 (Secondary Competencies)**: 이 봇이 부수적으로 키워주는 역량

#### **추천 조건**
각 역량에 대해 **임계값(threshold)**을 설정할 수 있습니다:
- 예: "질문력"을 **60**으로 설정하면, 사용자의 질문력이 60점 미만일 때 이 봇을 추천합니다.
- 여러 역량에 대한 조건을 동시에 설정 가능 (OR 조건)

---

## 사용 방법

### Step 1: Admin Panel 접속
1. Admin 계정으로 로그인
2. 좌측 메뉴에서 **Admin Panel** 클릭
3. **봇 템플릿** 탭 선택

### Step 2: 새 봇 템플릿 생성
1. **템플릿 생성** 버튼 클릭
2. 기본 정보 입력:
   - 이름: `창의력 부스터`
   - 설명: `창의적 사고를 키워주는 멘토`
   - Theme Color: `Purple`
   - Base Type: `Coaching`
   - System Prompt: 봇의 행동 지침 입력

3. **역량 설정 및 추천 조건** 섹션:
   - **주요 육성 역량**: `창의력`, `사고력` 선택 (파란색으로 표시됨)
   - **부차적 육성 역량**: `소통력` 선택 (보라색으로 표시됨)
   - **추천 조건**:
     - 창의력: `60` 입력
     - 사고력: `55` 입력

4. **저장** 버튼 클릭

### Step 3: 기존 봇 템플릿 수정
1. 봇 템플릿 카드에서 **수정** 버튼 클릭
2. 추천 조건 수정:
   - 예: t1 (소크라테스)의 질문력 임계값을 60 → 70으로 변경
3. **수정** 버튼 클릭

---

## 추천 메커니즘 동작 방식

### 1. 역량 기반 추천 (Competency Mode)
사용자의 역량 점수와 봇 템플릿의 `recommendedFor.competencyBelow` 설정을 비교:

```javascript
// 예: t1 (소크라테스) 설정
{
  recommendedFor: {
    competencyBelow: {
      questionQuality: 60,
      thinkingDepth: 60
    }
  }
}
```

- 사용자의 질문력이 60 미만 **OR** 사고력이 60 미만이면 추천
- 점수가 낮을수록 추천 우선순위가 높아짐

### 2. 하이브리드 추천 (Hybrid Mode - 기본값)
역량 기반 추천(60%) + 패턴 기반 추천(40%)을 결합:
- **패턴 기반**: 사용자의 봇 선호도, 학습 시간대, 대화 스타일 등 고려
- **최종 점수** = (역량 점수 × 0.6) + (패턴 점수 × 0.4)

### 3. API 호출 예시
```bash
GET /bots/recommended/{userId}?mode=hybrid
GET /bots/recommended/{userId}?mode=competency  # 역량만
GET /bots/recommended/{userId}?mode=pattern     # 패턴만
```

---

## 데이터베이스 스키마

### `ai-co-learner-bot-templates` 테이블
```json
{
  "templateId": "t1",
  "name": "소크라테스",
  "description": "질문하는 현자",
  "systemPrompt": "...",
  "themeColor": "blue",
  "baseType": "questioning",
  "primaryCompetencies": ["questionQuality", "thinkingDepth"],
  "secondaryCompetencies": ["communicationClarity"],
  "recommendedFor": {
    "competencyBelow": {
      "questionQuality": 60,
      "thinkingDepth": 60
    }
  },
  "createdAt": "2025-12-17T00:00:00.000Z",
  "updatedAt": "2025-12-17T00:00:00.000Z"
}
```

---

## 주요 변경 사항

### Frontend (AdminPanel.tsx)
- ✅ 역량 선택 UI (토글 버튼)
- ✅ 추천 조건 입력 폼 (역량별 임계값)
- ✅ Base Type 선택 드롭다운
- ✅ 생성/수정 시 새 필드 전송

### Backend (Lambda index.mjs)
- ✅ `createTemplate`: 새 필드 (baseType, primaryCompetencies, secondaryCompetencies, recommendedFor) 지원
- ✅ `updateTemplate`: 새 필드 업데이트 지원
- ✅ `getRecommendedTemplates`: 역량 기반 추천 로직 (기존과 동일하게 동작)

---

## 테스트 시나리오

### 시나리오 1: 새 봇 생성 및 추천 확인
1. Admin Panel에서 "창의력 부스터" 봇 생성
2. 추천 조건: `creativity < 60`
3. 테스트 사용자의 창의력 점수를 50으로 설정
4. Dashboard에서 "추천 봇" 섹션 확인
5. "창의력 부스터" 봇이 표시되는지 확인

### 시나리오 2: 기존 봇 추천 조건 수정
1. t1 (소크라테스) 봇의 추천 조건 수정
   - 질문력: 60 → 70
2. 질문력이 65인 사용자에게 t1 봇이 추천되는지 확인

### 시나리오 3: 역량 미달 시 추천 없음
1. 모든 역량이 70점 이상인 사용자
2. 추천 봇 목록이 비어있는지 확인

---

## 주의사항

### 1. 역량 키 이름 (정확히 일치해야 함)
```javascript
const COMPETENCIES = [
  'questionQuality',      // 질문력
  'thinkingDepth',        // 사고력
  'creativity',           // 창의력
  'communicationClarity', // 소통력
  'executionOriented',    // 실행력
  'collaborationSignal'   // 협업력
];
```

### 2. 추천 조건 설정 팁
- **너무 낮은 임계값 (< 30)**: 거의 모든 사용자에게 추천 안 됨
- **너무 높은 임계값 (> 80)**: 거의 모든 사용자에게 추천됨
- **권장 범위**: 50~70 사이로 설정

### 3. Primary vs Secondary Competencies
- **Primary**: 이 봇이 **주로** 키워주는 역량 (대시보드에서 강조 표시)
- **Secondary**: 이 봇이 **부수적으로** 키워주는 역량

### 4. Base Type
- `coaching`: 실행/목표 지향적 코칭
- `questioning`: 질문 기반 소크라테스식 대화
- `reflective`: 성찰과 깊은 사고 유도
- `supportive`: 정서적 지원과 격려

---

## 트러블슈팅

### 추천 봇이 표시되지 않음
1. **역량 데이터 확인**:
   ```bash
   aws dynamodb scan --table-name ai-co-learner-user-competencies \
     --filter-expression "userId = :userId" \
     --expression-attribute-values '{"":userId":{"S":"USER_ID"}}' \
     --region ap-northeast-2
   ```

2. **템플릿 설정 확인**:
   ```bash
   aws dynamodb scan --table-name ai-co-learner-bot-templates \
     --region ap-northeast-2
   ```

3. **Lambda 로그 확인**:
   ```bash
   aws logs tail /aws/lambda/ai-co-learner-chat --since 5m \
     --region ap-northeast-2 --format short --filter-pattern "recommended"
   ```

### 봇 수정 시 오류
- Frontend에서 전송하는 데이터 구조 확인 (개발자 도구 Network 탭)
- Lambda 로그에서 에러 메시지 확인

---

## 다음 단계

### 추가 개선 사항 (선택)
1. **추천 규칙 프리셋**
   - "초보자용", "중급자용", "고급자용" 프리셋 제공
   - 원클릭으로 추천 조건 일괄 설정

2. **추천 시뮬레이터**
   - Admin Panel에서 특정 역량 점수를 입력하면 어떤 봇이 추천될지 미리보기

3. **추천 통계 대시보드**
   - 각 봇이 얼마나 많이 추천되었는지 통계
   - 어떤 역량 조건이 가장 많이 트리거되는지 분석

4. **A/B 테스팅**
   - 추천 임계값을 변경했을 때 사용자 참여도 변화 추적

---

**마지막 업데이트**: 2025-12-17
**작성자**: Claude Sonnet 4.5
