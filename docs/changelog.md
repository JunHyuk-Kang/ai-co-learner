# 변경 이력 (Changelog)

## 2026-01-12 — 실시간 모니터링 대시보드

- Lambda `GET /admin/dashboard` 엔드포인트 추가
- 5개 DynamoDB 테이블 실시간 집계 (chat-sessions, users, competencies, user-bots, daily-quests)
- MetricCard 컴포넌트 생성 (6가지 컬러 테마)
- AdminPanel에 Dashboard 탭 추가 (기본 뷰)
- 시간대별 활동 차트 구현 (Recharts LineChart)
- 이탈 위험 자동 감지 (7일 미접속 사용자 알림)
- 가이드: [docs/admin-dashboard-guide.md](admin-dashboard-guide.md)

## 2025-12-31 — Sprint 1~4 완료

**Sprint 4**: Lambda Layer, Testing, CloudWatch 가이드 작성. TypeScript 빌드 경고 0개.

**Sprint 3**: docs/README.md 문서 인덱스 생성. 18개 문서 체계 분류.

**Sprint 2**: API 에러 표준화 (8개 에러코드), Lambda 환경 변수 문서화, Husky pre-commit hook.

**Sprint 1**: Vitest 테스트 프레임워크, logger.ts 로깅 시스템, ESLint+Prettier 설정.

## 2025-12-31 — 가격 정보 수정

Gemini 2.5 Flash 실제 가격 반영: 입력 $0.30/1M, 출력 $2.50/1M. B2B 과금 ₩10,000/월 확정.

## 2025-12-26 — AI 모델 전환

Claude 3 Haiku → Google Gemini 2.5 Flash. Exponential Backoff 재시도 로직 추가.

## 2025-11-27 이전 — Phase 1~7 구현

사용량 추적, 봇 역량 매핑, 스트리밍 채팅, 퀘스트/뱃지 시스템, 학습 패턴 분석.
