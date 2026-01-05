# AI Co-Learner 문서 가이드

> AI Co-Learner 프로젝트의 모든 문서를 체계적으로 정리한 인덱스 페이지입니다.

---

## 📚 핵심 가이드

이 섹션은 프로젝트의 주요 설계 및 운영에 관한 필수 문서입니다.

### [개발 로드맵](development-roadmap.md)
- **용도**: 프로젝트 개발 진행 상황 및 계획
- **주요 내용**:
  - Phase 1-7 완료 상태 (프로덕션 운영 중)
  - 각 단계별 구현 내용 (인프라, AI 채팅, 역량 분석, 게이미피케이션 등)
  - Phase 8-10 다음 단계 계획
- **대상 독자**: 개발자, PM, 기술 리드

### [AWS 아키텍처](aws-architecture.md)
- **용도**: AWS 인프라 구성 및 배포 리소스 정보
- **주요 내용**:
  - Lambda, DynamoDB, API Gateway, S3, CloudFront, Cognito 구성
  - 배포된 리소스 목록 (리전: ap-northeast-2)
  - 데이터 흐름 및 서비스 아키텍처
  - 각 리소스의 용도 및 구성
- **대상 독자**: 백엔드 개발자, DevOps, 아키텍트

### [UI/UX 디자인 가이드](ui-ux-guide.md)
- **용도**: 프로젝트의 디자인 시스템 및 사용자 경험 정의
- **주요 내용**:
  - 서비스 개요 및 타겟층 분석
  - 주요 과업(Core Tasks) 및 사용자 여정
  - 페이지별 구성 및 컴포넌트 설계
  - 디자인 토큰 (컬러, 타이포그래피, 간격)
  - 애니메이션 및 상호작용 패턴
- **대상 독자**: 프론트엔드 개발자, 디자이너, PM

### [사용량 추적 가이드](usage-tracking-guide.md)
- **용도**: 비용 관리 및 사용량 모니터링 시스템 운영
- **주요 내용**:
  - 자동 사용량 추적 메커니즘
  - 관리자 대시보드 기능
  - DynamoDB 테이블 구조 및 쿼리
  - API 엔드포인트 및 비용 계산 로직
  - 월간 비용 추정 (약 $9/월 with Google Gemini 2.5 Flash)
- **대상 독자**: 관리자, 재무팀, DevOps

---

## 🛠️ 개발 가이드

이 섹션은 개발 중 필요한 기술 레퍼런스 및 문제 해결 방법을 제공합니다.

### [API 에러 응답 가이드](api-error-responses.md)
- **용도**: API 에러 처리 표준화
- **주요 내용**:
  - 공통 에러 응답 형식 (JSON 구조)
  - 에러 코드 목록 (CODE, HTTP 상태, 설명)
  - 클라이언트 측 에러 처리 방법
  - 로깅 및 모니터링 가이드
- **대상 독자**: 백엔드 개발자, 프론트엔드 개발자

### [Lambda 환경 변수 가이드](lambda-environment-variables.md)
- **용도**: Lambda 함수별 환경 변수 설정 및 관리
- **주요 내용**:
  - 필수 환경 변수 목록
  - DynamoDB 테이블 환경 변수 맵핑
  - Lambda별 필요 환경 변수 구성
  - 환경 변수 설정 방법
  - Deploy Script 자동화
  - 트러블슈팅
- **대상 독자**: 백엔드 개발자, DevOps, 솔루션 아키텍트

---

## 🎯 보조 문서

프로젝트 특정 기능 및 운영에 관한 보조 문서입니다.

### [역량 진단 질문 집](competency-assessment-questions.md)
- **용도**: 초기 역량 진단 시스템의 질문 관리
- **주요 내용**:
  - 8개의 개방형 질문 (역량 진단용)
  - 각 질문별 평가 루브릭
  - AI 분석 기준 및 채점 로직

### [관리자 봇 추천 가이드](admin-bot-recommendation-guide.md)
- **용도**: 관리자 패널의 봇 추천 시스템 운영
- **주요 내용**:
  - 봇 템플릿 관리 방법
  - 역량 기반 추천 알고리즘
  - 사용자별 맞춤형 봇 추천 로직

### [사용량 대시보드 트러블슈팅](usage-dashboard-troubleshooting.md)
- **용도**: 관리자 대시보드 문제 해결
- **주요 내용**:
  - 자주 발생하는 오류 및 해결 방법
  - 데이터 불일치 디버깅
  - 성능 최적화 팁

---

## 📊 개선 과제 및 향후 계획

### [다음 할 일 (Next TODO)](next_todo.md)
- **작성일**: 2025-12-30
- **용도**: 우선순위별 개선 과제 추적
- **주요 내용**:
  - 긴급 수정 필요 (Critical) 항목
  - 높은 우선순위 개선사항
  - 중간/낮은 우선순위 개선사항
  - 기술 부채 및 리팩토링 계획
- **대상 독자**: 개발 팀, PM, 기술 리드

---

## 📂 아카이브

참고용 이전 문서 및 설계 문서 모음입니다. 현재 프로젝트와 직접 연관이 없지만, 역사적 배경 및 설계 의도를 이해하는 데 도움이 됩니다.

### 아카이브 문서 목록

- **[API_GATEWAY_SETUP.md](archive/API_GATEWAY_SETUP.md)** - API Gateway 초기 설정 기록
- **[AWS_PROGRESS.md](archive/AWS_PROGRESS.md)** - AWS 구축 진행 상황 기록
- **[AWS_SERVERLESS_CHECKLIST.md](archive/AWS_SERVERLESS_CHECKLIST.md)** - 서버리스 인프라 체크리스트
- **[ai-analysis-implementation.md](archive/ai-analysis-implementation.md)** - AI 분석 기능 구현 문서
- **[data-strategy.md](archive/data-strategy.md)** - 데이터 전략 및 설계
- **[development-plan.md](archive/development-plan.md)** - 이전 개발 계획
- **[serverless_architecture_design.md](archive/serverless_architecture_design.md)** - 서버리스 아키텍처 설계 초안
- **[total_development-plan.md](archive/total_development-plan.md)** - 종합 개발 계획 (구 버전)

### 아카이브 사용 시기
- 프로젝트 역사 이해 필요시
- 과거 설계 결정 배경 학습시
- 이전 기술 스택 또는 접근 방식 참고시

---

## 📖 빠른 시작 가이드

### 1단계: 프로젝트 이해하기
- [개발 로드맵](development-roadmap.md)으로 현재 상태 파악
- [AWS 아키텍처](aws-architecture.md)로 인프라 이해

### 2단계: 개발 환경 설정하기
- [Lambda 환경 변수 가이드](lambda-environment-variables.md) 참고
- `.env.local` 파일 설정

### 3단계: 기능 개발하기
- [API 에러 응답 가이드](api-error-responses.md)로 표준 준수
- [UI/UX 디자인 가이드](ui-ux-guide.md)로 디자인 일관성 유지

### 4단계: 배포 및 모니터링
- Lambda 함수 배포 (AWS CLI 또는 `deploy.bat`)
- [사용량 추적 가이드](usage-tracking-guide.md)로 비용 모니터링

---

## 📋 프로젝트 현황 요약

| 항목 | 상태 | 비고 |
|------|------|------|
| **프로덕션 환경** | ✅ 운영 중 | AP-NE-2 (서울) 리전 |
| **AI 모델** | Google Gemini 2.5 Flash | 비용 70% 절감 (대비 Claude) |
| **DynamoDB 테이블** | 10개 | TTL 설정으로 비용 최적화 |
| **Lambda 함수** | 8개 | chat-api, 배치 분석, 퀘스트 등 |
| **테스트 커버리지** | ⚠️ 낮음 | 다음 우선순위 (next_todo.md 참고) |
| **문서화** | ✅ 완전 | 이 README 포함 |

---

## 🔗 관련 링크

- **프로젝트 루트 CLAUDE.md**: 프로젝트 전체 가이드
- **GitHub 저장소**: [Synnex AI Co-Learner](https://github.com/synnex/ai-co-learner)
- **AWS 콘솔**: ap-northeast-2 리전

---

**마지막 업데이트**: 2025-12-31
**문서 관리자**: AI Co-Learner 개발 팀
