# API 에러 응답 문서

AI Co-Learner 프로젝트의 API 에러 응답 규격 및 처리 가이드

---

## 공통 에러 형식

모든 API 에러 응답은 다음과 같은 일관된 JSON 형식을 사용합니다:

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "사용자 친화적 메시지",
    "details": { }
  }
}
```

- **code**: 에러 식별을 위한 고유 코드 (대문자, 언더스코어)
- **message**: 사용자에게 표시할 친화적인 에러 메시지 (한글/영문)
- **details**: 선택적 필드, 추가 컨텍스트 정보 (디버깅용)

---

## 에러 코드 목록

| 에러 코드 | HTTP 상태 | 설명 | 재시도 가능 | 사용 예시 |
|----------|----------|------|------------|----------|
| **AUTH_REQUIRED** | 401 | 인증 필요 | ❌ | Authorization 헤더 누락 또는 토큰 만료 |
| **FORBIDDEN** | 403 | 권한 없음 | ❌ | ADMIN 전용 API를 일반 사용자가 호출 |
| **NOT_FOUND** | 404 | 리소스 없음 | ❌ | 존재하지 않는 봇/세션/사용자 접근 |
| **VALIDATION_ERROR** | 400 | 입력 검증 실패 | ❌ | 필수 필드 누락, 잘못된 형식 |
| **RATE_LIMIT** | 429 | 요청 제한 초과 | ✅ | Gemini API 할당량 초과 |
| **GEMINI_ERROR** | 502 | AI 모델 오류 | ✅ | Gemini API 일시적 장애 |
| **DB_ERROR** | 503 | 데이터베이스 오류 | ✅ | DynamoDB 연결 실패 |
| **SERVER_ERROR** | 500 | 서버 내부 오류 | ⚠️ | 예상치 못한 예외 |

### 재시도 가능 여부
- ✅ **재시도 가능**: 클라이언트가 Exponential Backoff로 재시도 권장
- ❌ **재시도 불가**: 즉시 사용자에게 에러 표시
- ⚠️ **조건부**: 특정 상황에서만 재시도 (예: 네트워크 일시 장애)

---

## Exponential Backoff 로직

API 호출 실패 시 재시도 전략입니다. 특히 **RATE_LIMIT**, **GEMINI_ERROR**, **DB_ERROR**에서 사용합니다.

### 재시도 파라미터
- **초기 대기 시간**: 1초
- **최대 재시도 횟수**: 3회
- **대기 시간 증가**: 지수 함수 (2^n)
  - 1회 실패 → 1초 대기 후 재시도
  - 2회 실패 → 2초 대기 후 재시도
  - 3회 실패 → 4초 대기 후 재시도
  - 4회 실패 → 최종 에러 반환

### Lambda 함수 구현 예시

```javascript
async function callWithRetry(fn, maxRetries = 3) {
  let lastError;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // 재시도 불가능한 에러는 즉시 throw
      if (error.code === 'AUTH_REQUIRED' || error.code === 'FORBIDDEN') {
        throw error;
      }

      // 마지막 시도면 에러 throw
      if (attempt === maxRetries) {
        throw error;
      }

      // Exponential Backoff 대기
      const waitTime = Math.pow(2, attempt) * 1000; // 1초, 2초, 4초
      console.log(`Retry attempt ${attempt + 1}/${maxRetries} after ${waitTime}ms`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }

  throw lastError;
}

// 사용 예시
try {
  const result = await callWithRetry(async () => {
    return await model.generateContent(prompt);
  });
} catch (error) {
  return errorResponse('GEMINI_ERROR', 'AI 모델 응답 실패', 502);
}
```

---

## Lambda 함수 표준화 코드

모든 Lambda 함수는 다음 헬퍼 함수를 사용하여 일관된 에러 응답을 반환해야 합니다.

### errorResponse 헬퍼 함수

```javascript
/**
 * 표준화된 에러 응답 생성
 * @param {string} code - 에러 코드 (예: 'AUTH_REQUIRED')
 * @param {string} message - 사용자 친화적 메시지
 * @param {number} statusCode - HTTP 상태 코드 (기본값: 500)
 * @param {object} details - 선택적 추가 정보
 * @returns {object} API Gateway 응답 객체
 */
function errorResponse(code, message, statusCode = 500, details = null) {
  const errorBody = {
    error: {
      code,
      message
    }
  };

  // details가 있으면 추가
  if (details) {
    errorBody.error.details = details;
  }

  return {
    statusCode,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type,Authorization',
      'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS'
    },
    body: JSON.stringify(errorBody)
  };
}

/**
 * 성공 응답 생성
 * @param {object} data - 응답 데이터
 * @param {number} statusCode - HTTP 상태 코드 (기본값: 200)
 * @returns {object} API Gateway 응답 객체
 */
function successResponse(data, statusCode = 200) {
  return {
    statusCode,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type,Authorization',
      'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS'
    },
    body: JSON.stringify(data)
  };
}
```

### Lambda 함수 표준 구조

```javascript
export const handler = async (event) => {
  // OPTIONS 요청 처리 (CORS preflight)
  if (event.httpMethod === 'OPTIONS') {
    return successResponse({}, 204);
  }

  try {
    // 1. 인증 확인
    const userId = event.requestContext?.authorizer?.claims?.sub;
    if (!userId) {
      return errorResponse('AUTH_REQUIRED', '로그인이 필요합니다.', 401);
    }

    // 2. 입력 검증
    const body = JSON.parse(event.body || '{}');
    if (!body.requiredField) {
      return errorResponse(
        'VALIDATION_ERROR',
        '필수 필드가 누락되었습니다.',
        400,
        { missingFields: ['requiredField'] }
      );
    }

    // 3. 권한 확인 (필요 시)
    const userRole = await getUserRole(userId);
    if (userRole !== 'ADMIN') {
      return errorResponse('FORBIDDEN', '관리자 권한이 필요합니다.', 403);
    }

    // 4. 비즈니스 로직 실행 (재시도 로직 포함)
    const result = await callWithRetry(async () => {
      return await performBusinessLogic(body);
    });

    // 5. 성공 응답
    return successResponse(result);

  } catch (error) {
    console.error('Lambda error:', error);

    // 에러 타입별 처리
    if (error.code === 'ResourceNotFoundException') {
      return errorResponse('NOT_FOUND', '요청한 리소스를 찾을 수 없습니다.', 404);
    }

    if (error.code === 'RESOURCE_EXHAUSTED') {
      return errorResponse('RATE_LIMIT', 'API 호출 한도를 초과했습니다. 잠시 후 다시 시도해주세요.', 429);
    }

    // 기본 서버 에러
    return errorResponse(
      'SERVER_ERROR',
      '서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.',
      500,
      { errorMessage: error.message }
    );
  }
};
```

---

## CORS 에러 처리 주의사항

### 중요: 모든 응답에 CORS 헤더 필수

Lambda 함수에서 가장 흔한 실수는 **에러 응답에서 CORS 헤더를 누락**하는 것입니다.

#### 잘못된 예시 (CORS 에러 발생)

```javascript
export const handler = async (event) => {
  try {
    // 비즈니스 로직
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({ success: true })
    };
  } catch (error) {
    // ❌ CORS 헤더 누락!
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};
```

#### 올바른 예시

```javascript
export const handler = async (event) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS'
  };

  try {
    // 비즈니스 로직
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({ success: true })
    };
  } catch (error) {
    // ✅ 에러 응답에도 CORS 헤더 포함
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({
        error: {
          code: 'SERVER_ERROR',
          message: error.message
        }
      })
    };
  }
};
```

### CORS Preflight 요청 처리

모든 Lambda 함수는 OPTIONS 메서드를 처리해야 합니다:

```javascript
export const handler = async (event) => {
  // OPTIONS 요청은 즉시 204 응답
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type,Authorization',
        'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS'
      },
      body: ''
    };
  }

  // 나머지 로직...
};
```

---

## 프론트엔드 에러 처리 예시

### React 컴포넌트에서 API 호출

```typescript
import { useState } from 'react';

interface ApiError {
  code: string;
  message: string;
  details?: any;
}

function useApiCall<T>() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  const call = async (
    apiFunction: () => Promise<T>,
    options?: {
      maxRetries?: number;
      onRetry?: (attempt: number) => void;
    }
  ): Promise<T | null> => {
    setLoading(true);
    setError(null);

    const maxRetries = options?.maxRetries ?? 3;
    let lastError: ApiError | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const result = await apiFunction();
        setLoading(false);
        return result;
      } catch (err: any) {
        lastError = err.error || {
          code: 'UNKNOWN_ERROR',
          message: err.message || '알 수 없는 오류가 발생했습니다.'
        };

        // 재시도 불가능한 에러는 즉시 중단
        if (['AUTH_REQUIRED', 'FORBIDDEN', 'NOT_FOUND', 'VALIDATION_ERROR'].includes(lastError.code)) {
          break;
        }

        // 마지막 시도가 아니면 재시도
        if (attempt < maxRetries) {
          const waitTime = Math.pow(2, attempt) * 1000;
          options?.onRetry?.(attempt + 1);
          await new Promise(resolve => setTimeout(resolve, waitTime));
          continue;
        }
      }
    }

    setError(lastError);
    setLoading(false);
    return null;
  };

  return { call, loading, error };
}

// 사용 예시
function ChatComponent() {
  const { call, loading, error } = useApiCall<{ message: string }>();
  const [retryCount, setRetryCount] = useState(0);

  const sendMessage = async (message: string) => {
    const result = await call(
      () => fetch('/api/chat/stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({ message })
      }).then(res => {
        if (!res.ok) {
          return res.json().then(data => Promise.reject(data));
        }
        return res.json();
      }),
      {
        maxRetries: 3,
        onRetry: (attempt) => {
          setRetryCount(attempt);
          console.log(`재시도 중... (${attempt}/3)`);
        }
      }
    );

    if (result) {
      console.log('메시지 전송 성공:', result);
    }
  };

  return (
    <div>
      {loading && (
        <div>
          메시지 전송 중...
          {retryCount > 0 && ` (재시도 ${retryCount}/3)`}
        </div>
      )}
      {error && (
        <div className="error-banner">
          <strong>{error.code}</strong>: {error.message}
        </div>
      )}
      {/* 채팅 UI */}
    </div>
  );
}
```

### 에러 메시지 한글화

```typescript
const ERROR_MESSAGES: Record<string, string> = {
  'AUTH_REQUIRED': '로그인이 필요합니다. 다시 로그인해주세요.',
  'FORBIDDEN': '이 작업을 수행할 권한이 없습니다.',
  'NOT_FOUND': '요청한 정보를 찾을 수 없습니다.',
  'VALIDATION_ERROR': '입력한 정보가 올바르지 않습니다.',
  'RATE_LIMIT': 'API 호출 한도를 초과했습니다. 잠시 후 다시 시도해주세요.',
  'GEMINI_ERROR': 'AI 응답 중 오류가 발생했습니다. 다시 시도해주세요.',
  'DB_ERROR': '데이터베이스 연결에 실패했습니다. 잠시 후 다시 시도해주세요.',
  'SERVER_ERROR': '서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.',
};

function getErrorMessage(error: ApiError): string {
  return ERROR_MESSAGES[error.code] || error.message || '알 수 없는 오류가 발생했습니다.';
}
```

### 전역 에러 처리 (React Context)

```typescript
import { createContext, useContext, useState, ReactNode } from 'react';

interface ErrorContextType {
  showError: (error: ApiError) => void;
  clearError: () => void;
  currentError: ApiError | null;
}

const ErrorContext = createContext<ErrorContextType | undefined>(undefined);

export function ErrorProvider({ children }: { children: ReactNode }) {
  const [currentError, setCurrentError] = useState<ApiError | null>(null);

  const showError = (error: ApiError) => {
    setCurrentError(error);
    // 5초 후 자동으로 에러 메시지 제거 (재시도 가능한 에러만)
    if (['RATE_LIMIT', 'GEMINI_ERROR', 'DB_ERROR'].includes(error.code)) {
      setTimeout(() => setCurrentError(null), 5000);
    }
  };

  const clearError = () => setCurrentError(null);

  return (
    <ErrorContext.Provider value={{ showError, clearError, currentError }}>
      {children}
      {currentError && (
        <div className="fixed top-4 right-4 bg-red-500 text-white p-4 rounded-lg shadow-lg">
          <button onClick={clearError} className="float-right ml-4">×</button>
          <strong>{currentError.code}</strong>
          <p>{getErrorMessage(currentError)}</p>
        </div>
      )}
    </ErrorContext.Provider>
  );
}

export function useError() {
  const context = useContext(ErrorContext);
  if (!context) {
    throw new Error('useError must be used within ErrorProvider');
  }
  return context;
}
```

---

## 에러 모니터링 & 디버깅

### CloudWatch Logs 필터

Lambda 함수에서 에러 로그를 쉽게 찾기 위한 CloudWatch Logs Insights 쿼리:

```sql
fields @timestamp, @message
| filter @message like /ERROR/
| sort @timestamp desc
| limit 100
```

특정 에러 코드만 필터링:

```sql
fields @timestamp, @message
| filter @message like /GEMINI_ERROR/
| stats count() by bin(5m)
```

### 에러 알림 설정 (CloudWatch Alarms)

1. **RATE_LIMIT 에러 급증**
   - 메트릭: HTTP 429 응답
   - 임계값: 5분 내 100회 이상
   - 액션: SNS 알림 → 개발자 이메일

2. **SERVER_ERROR 빈도 증가**
   - 메트릭: HTTP 500 응답
   - 임계값: 1시간 내 50회 이상
   - 액션: PagerDuty 알림

3. **Gemini API 장애**
   - 메트릭: GEMINI_ERROR 발생
   - 임계값: 5분 내 20회 이상
   - 액션: 백업 모델 자동 전환 (향후 구현)

---

## 배포 전 체크리스트

Lambda 함수 배포 전 다음 사항을 반드시 확인하세요:

- [ ] 모든 응답에 CORS 헤더 포함 (성공/실패 모두)
- [ ] OPTIONS 메서드 처리 구현
- [ ] errorResponse 헬퍼 함수 사용
- [ ] try-catch 블록에서 에러 응답 CORS 헤더 확인
- [ ] 재시도 로직 구현 (RATE_LIMIT, GEMINI_ERROR 등)
- [ ] 에러 로그에 충분한 컨텍스트 포함 (userId, requestId 등)
- [ ] 민감한 정보 (API 키, 토큰) 로그에 출력하지 않기

---

## 관련 문서

- [AWS 아키텍처](./aws-architecture.md)
- [개발 로드맵](./development-roadmap.md)
- [사용량 추적 가이드](./usage-tracking-guide.md)

---

**마지막 업데이트**: 2025-12-31
