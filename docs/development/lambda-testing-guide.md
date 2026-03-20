# Lambda 함수 테스트 전략 및 가이드

AI Co-Learner 프로젝트의 Lambda 함수를 효과적으로 테스트하기 위한 종합 가이드입니다.

---

## 1. 개요

### 1.1 Lambda 함수 테스트의 중요성

Lambda 함수는 다음과 같은 특성으로 인해 특별한 테스트 전략이 필요합니다:

- **외부 의존성 많음**: DynamoDB, Google Gemini API, Cognito 등과의 통합
- **네트워크 요청**: 외부 API 호출로 인한 지연과 실패 가능성
- **상태 관리**: DynamoDB에서의 읽기/쓰기 작업
- **실행 환경**: 로컬 환경과 AWS Lambda 환경의 차이

### 1.2 테스트 유형별 설명

| 테스트 유형 | 목표 | 범위 | 예시 |
|-----------|------|------|------|
| **단위 테스트** | 개별 함수의 로직 검증 | 함수 내 비즈니스 로직 | `retryWithBackoff` 함수, `checkUserRole` 함수 |
| **통합 테스트** | AWS 서비스와의 상호작용 | DynamoDB, Gemini API 모킹 | 메시지 저장 및 API 호출 |
| **E2E 테스트** | 전체 요청/응답 플로우 | 전체 핸들러 함수 | `/chat/stream` 완전 흐름 |
| **성능 테스트** | 응답 시간, 메모리 사용량 | 대량 데이터 처리 | 1000개 메시지 조회 |

---

## 2. 테스트 전략

### 2.1 단위 테스트: 개별 함수 로직

**목표**: 외부 의존성 없이 순수 로직 테스트

**예시: Exponential Backoff 재시도 함수**

```javascript
// lambda/chat-api/__tests__/retryWithBackoff.test.mjs
import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('retryWithBackoff', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it('should succeed on first attempt', async () => {
    const successFn = vi.fn().mockResolvedValue('success');
    const result = await retryWithBackoff(successFn, 2);

    expect(result).toBe('success');
    expect(successFn).toHaveBeenCalledTimes(1);
  });

  it('should retry on rate limit error and succeed', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('RESOURCE_EXHAUSTED'))
      .mockResolvedValue('success');

    const promise = retryWithBackoff(fn, 2);

    // Fast-forward through delays
    vi.advanceTimersByTimeAsync(1000); // 첫 번째 재시도 대기

    const result = await promise;

    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('should fail after max retries exceeded', async () => {
    const fn = vi.fn()
      .mockRejectedValue(new Error('RESOURCE_EXHAUSTED'));

    const promise = retryWithBackoff(fn, 2);

    // Fast-forward through all delays
    vi.advanceTimersByTimeAsync(1000); // 첫 번째 재시도
    vi.advanceTimersByTimeAsync(2000); // 두 번째 재시도

    await expect(promise).rejects.toThrow('RESOURCE_EXHAUSTED');
    expect(fn).toHaveBeenCalledTimes(3); // 초기 + 2회 재시도
  });

  it('should not retry on non-retryable errors', async () => {
    const fn = vi.fn()
      .mockRejectedValue(new Error('Invalid API key'));

    await expect(retryWithBackoff(fn, 2)).rejects.toThrow('Invalid API key');
    expect(fn).toHaveBeenCalledTimes(1); // 재시도 없음
  });

  it('should exponentially increase delay', async () => {
    const delays = [];
    const originalSetTimeout = setTimeout;

    vi.spyOn(global, 'setTimeout').mockImplementation((cb, delay) => {
      delays.push(delay);
      return originalSetTimeout(cb, 0); // 즉시 실행
    });

    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('RESOURCE_EXHAUSTED'))
      .mockRejectedValueOnce(new Error('RESOURCE_EXHAUSTED'))
      .mockResolvedValue('success');

    await retryWithBackoff(fn, 2);

    // 1000 * 2^0 = 1000, 1000 * 2^1 = 2000
    expect(delays).toEqual([1000, 2000]);
  });
});
```

**예시: 권한 체크 함수**

```javascript
// lambda/chat-api/__tests__/checkUserRole.test.mjs
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as AWS from '@aws-sdk/lib-dynamodb';

vi.mock('@aws-sdk/lib-dynamodb');

describe('checkUserRole', () => {
  let mockDynamoClient;

  beforeEach(() => {
    mockDynamoClient = {
      send: vi.fn(),
    };
    vi.mocked(AWS.DynamoDBDocumentClient.from).mockReturnValue(mockDynamoClient);
  });

  it('should return authorized=true for valid user with allowed role', async () => {
    mockDynamoClient.send.mockResolvedValue({
      Item: { userId: 'user-123', role: 'ADMIN' }
    });

    // checkUserRole 호출
    const result = await checkUserRole('user-123', ['ADMIN', 'SUPER_USER']);

    expect(result.authorized).toBe(true);
    expect(result.role).toBe('ADMIN');
  });

  it('should return authorized=false for user with disallowed role', async () => {
    mockDynamoClient.send.mockResolvedValue({
      Item: { userId: 'user-123', role: 'USER' }
    });

    const result = await checkUserRole('user-123', ['ADMIN']);

    expect(result.authorized).toBe(false);
    expect(result.error).toContain('Access denied');
  });

  it('should return authorized=false when user not found', async () => {
    mockDynamoClient.send.mockResolvedValue({ Item: null });

    const result = await checkUserRole('user-123', ['ADMIN']);

    expect(result.authorized).toBe(false);
    expect(result.error).toBe('User not found');
  });

  it('should use default role=USER when not specified', async () => {
    mockDynamoClient.send.mockResolvedValue({
      Item: { userId: 'user-123' } // role 필드 없음
    });

    const result = await checkUserRole('user-123', ['USER']);

    expect(result.authorized).toBe(true);
  });

  it('should handle DynamoDB errors gracefully', async () => {
    mockDynamoClient.send.mockRejectedValue(new Error('DynamoDB timeout'));

    const result = await checkUserRole('user-123', ['ADMIN']);

    expect(result.authorized).toBe(false);
    expect(result.error).toBe('Failed to verify user role');
  });
});
```

### 2.2 통합 테스트: AWS 서비스와의 상호작용

**목표**: 실제 DynamoDB 및 외부 API와의 상호작용 테스트

**예시: 메시지 저장 및 조회**

```javascript
// lambda/chat-api/__tests__/integration/chatSession.test.mjs
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DynamoDBDocumentClient, PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { GoogleGenerativeAI } from '@google/generative-ai';

// AWS SDK 및 Google API 모킹
vi.mock('@aws-sdk/lib-dynamodb');
vi.mock('@google/generative-ai');

describe('Chat Session Integration', () => {
  let mockDynamoClient;
  let mockGeminiClient;

  beforeEach(() => {
    mockDynamoClient = {
      send: vi.fn(),
    };

    mockGeminiClient = {
      getGenerativeModel: vi.fn().mockReturnValue({
        startChat: vi.fn().mockReturnValue({
          sendMessage: vi.fn().mockResolvedValue({
            response: {
              text: () => 'Mock AI response',
              usageMetadata: {
                promptTokenCount: 50,
                candidatesTokenCount: 100,
              }
            }
          })
        })
      })
    };

    vi.mocked(DynamoDBDocumentClient.from).mockReturnValue(mockDynamoClient);
    vi.mocked(GoogleGenerativeAI).mockReturnValue(mockGeminiClient);
  });

  it('should save chat message and retrieve history', async () => {
    const sessionId = 'session-123';
    const userId = 'user-123';
    const message = 'Hello, AI!';

    // 1. 대화 히스토리 조회
    mockDynamoClient.send.mockResolvedValueOnce({
      Items: [
        {
          sessionId,
          timestamp: Date.now() - 60000,
          userMessage: 'Previous message',
          aiMessage: 'Previous response'
        }
      ]
    });

    // 2. 메시지 저장
    mockDynamoClient.send.mockResolvedValueOnce({});

    // 실제 함수 호출 (sendChatMessage)
    // const result = await sendChatMessage(event, headers);

    // 검증
    expect(mockDynamoClient.send).toHaveBeenCalledWith(
      expect.objectContaining({
        constructor: { name: 'QueryCommand' }
      })
    );

    expect(mockDynamoClient.send).toHaveBeenCalledWith(
      expect.objectContaining({
        constructor: { name: 'PutCommand' }
      })
    );
  });

  it('should track token usage after API call', async () => {
    // Gemini API 호출
    const model = mockGeminiClient.getGenerativeModel({
      model: 'gemini-2.5-flash'
    });

    const chat = model.startChat({ history: [] });
    const result = await chat.sendMessage('Test message');

    expect(result.response.usageMetadata.promptTokenCount).toBe(50);
    expect(result.response.usageMetadata.candidatesTokenCount).toBe(100);
  });

  it('should handle DynamoDB query with proper key conditions', async () => {
    const sessionId = 'session-123';

    mockDynamoClient.send.mockResolvedValue({ Items: [] });

    // getSession 함수 호출 시 QueryCommand 검증
    // QueryCommand는 SessionId를 PK로 사용하고, 최대 10개 항목 조회
    expect(mockDynamoClient.send).not.toHaveBeenCalled();

    // 실제 호출 시뮬레이션
    mockDynamoClient.send(new QueryCommand({
      TableName: 'ai-co-learner-chat-sessions',
      KeyConditionExpression: 'sessionId = :sessionId',
      ExpressionAttributeValues: {
        ':sessionId': sessionId
      },
      Limit: 10,
      ScanIndexForward: false
    }));

    expect(mockDynamoClient.send).toHaveBeenCalled();
  });
});
```

### 2.3 E2E 테스트: 완전한 요청/응답 플로우

**목표**: 전체 Lambda 핸들러의 동작 검증

**예시: `/chat/stream` 엔드포인트 테스트**

```javascript
// lambda/chat-api/__tests__/e2e/chatStream.test.mjs
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@aws-sdk/lib-dynamodb');
vi.mock('@google/generative-ai');
vi.mock('@aws-sdk/client-cognito-identity-provider');

describe('POST /chat/stream E2E', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should stream chat response with proper CORS headers', async () => {
    const event = {
      httpMethod: 'POST',
      path: '/chat/stream',
      body: JSON.stringify({
        userId: 'user-123',
        sessionId: 'session-123',
        message: 'Hello, world!',
        botId: 'bot-123'
      })
    };

    // handler 호출 (실제 구현 필요)
    // const response = await handler(event);

    // 검증 사항:
    // 1. statusCode 200
    // 2. CORS 헤더 포함
    //    - Access-Control-Allow-Origin: *
    //    - Access-Control-Allow-Headers: Content-Type,Authorization,...
    // 3. Content-Type: application/json
    // 4. Body는 newline-delimited JSON 형식
  });

  it('should validate required fields', async () => {
    const event = {
      httpMethod: 'POST',
      path: '/chat/stream',
      body: JSON.stringify({
        userId: 'user-123'
        // sessionId, message 누락
      })
    };

    // const response = await handler(event);

    // 검증:
    // statusCode: 400
    // error: "Missing required fields: userId, sessionId, message"
    // CORS 헤더 포함 확인
  });

  it('should handle Gemini API errors with retries', async () => {
    // 첫 번째 호출: RESOURCE_EXHAUSTED 에러
    // 두 번째 호출: 성공
    // 재시도 로직 동작 확인
  });

  it('should save session history correctly', async () => {
    // 요청 처리
    // DynamoDB에 저장된 데이터 검증:
    // - sessionId 맞음
    // - userMessage 저장됨
    // - aiMessage 저장됨
    // - timestamp 기록됨
  });
});
```

---

## 3. 테스트 프레임워크 선택

### 3.1 Vitest vs Jest 비교

| 측면 | Vitest | Jest |
|------|--------|------|
| **설정 복잡도** | 낮음 (Vite 기반) | 중간 |
| **ESM 지원** | 완벽함 | 제한적 (workaround 필요) |
| **성능** | 빠름 (병렬 실행) | 보통 |
| **Watch 모드** | 우수함 | 표준 |
| **TypeScript 지원** | 좋음 | 좋음 |
| **커뮤니티** | 점점 증가 | 매우 활발 |

### 3.2 Lambda ESM 환경에서 Vitest 추천 이유

```javascript
// ESM 환경에서 모듈 import/export
export const handler = async (event) => { ... };
import { GoogleGenerativeAI } from '@google/generative-ai';

// Vitest는 ESM을 네이티브로 지원
import { describe, it, expect } from 'vitest';
import { handler } from '../index.mjs';

// Jest는 ESM 모듈을 동기적으로 로드할 수 없어서 workaround 필요
// (--experimental-vm-modules 플래그 필요)
```

---

## 4. DynamoDB 모킹

### 4.1 DynamoDB DocumentClient 모킹

**설정**

```javascript
// lambda/chat-api/__tests__/setup.mjs
import { vi } from 'vitest';

// DynamoDB 모킹 설정
vi.mock('@aws-sdk/lib-dynamodb', () => ({
  DynamoDBDocumentClient: {
    from: vi.fn().mockReturnValue({
      send: vi.fn(),
    })
  },
  GetCommand: vi.fn((params) => ({ command: 'get', params })),
  PutCommand: vi.fn((params) => ({ command: 'put', params })),
  QueryCommand: vi.fn((params) => ({ command: 'query', params })),
  UpdateCommand: vi.fn((params) => ({ command: 'update', params })),
  DeleteCommand: vi.fn((params) => ({ command: 'delete', params })),
  ScanCommand: vi.fn((params) => ({ command: 'scan', params })),
}));
```

**GetCommand 테스트**

```javascript
// 사용자 프로필 조회
it('should retrieve user profile', async () => {
  const mockClient = {
    send: vi.fn().mockResolvedValue({
      Item: {
        userId: 'user-123',
        username: 'testuser',
        name: 'Test User',
        role: 'USER'
      }
    })
  };

  // GetCommand 실행 시뮬레이션
  mockClient.send(new GetCommand({
    TableName: 'ai-co-learner-users',
    Key: { userId: 'user-123' }
  }));

  // 검증
  expect(mockClient.send).toHaveBeenCalledWith(
    expect.objectContaining({
      params: expect.objectContaining({
        Key: { userId: 'user-123' }
      })
    })
  );
});
```

**QueryCommand 테스트 (복합 키 조회)**

```javascript
// 채팅 세션의 메시지 히스토리 조회
it('should query chat session history', async () => {
  const mockClient = {
    send: vi.fn().mockResolvedValue({
      Items: [
        {
          sessionId: 'session-123',
          timestamp: Date.now(),
          userMessage: 'Hello',
          aiMessage: 'Hi there!'
        }
      ]
    })
  };

  mockClient.send(new QueryCommand({
    TableName: 'ai-co-learner-chat-sessions',
    KeyConditionExpression: 'sessionId = :sessionId',
    ExpressionAttributeValues: {
      ':sessionId': 'session-123'
    },
    Limit: 10,
    ScanIndexForward: false // 최신순 정렬
  }));

  expect(mockClient.send).toHaveBeenCalled();
  const call = mockClient.send.mock.calls[0][0];
  expect(call.params.KeyConditionExpression).toBe('sessionId = :sessionId');
});
```

**PutCommand 테스트 (데이터 저장)**

```javascript
// 메시지 저장
it('should save chat message', async () => {
  const mockClient = {
    send: vi.fn().mockResolvedValue({})
  };

  const timestamp = Date.now();
  mockClient.send(new PutCommand({
    TableName: 'ai-co-learner-chat-sessions',
    Item: {
      sessionId: 'session-123',
      timestamp,
      userMessage: 'Hello',
      aiMessage: 'Hi!',
      ttl: Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60) // 30일 TTL
    }
  }));

  expect(mockClient.send).toHaveBeenCalledWith(
    expect.objectContaining({
      params: expect.objectContaining({
        Item: expect.objectContaining({
          sessionId: 'session-123',
          userMessage: 'Hello',
          aiMessage: 'Hi!'
        })
      })
    })
  );
});
```

**UpdateCommand 테스트**

```javascript
// 역량 점수 업데이트
it('should update user competencies', async () => {
  const mockClient = {
    send: vi.fn().mockResolvedValue({
      Attributes: { userId: 'user-123', updated: true }
    })
  };

  mockClient.send(new UpdateCommand({
    TableName: 'ai-co-learner-user-competencies',
    Key: { userId: 'user-123' },
    UpdateExpression: 'SET #competencies = :competencies, #updated = :now',
    ExpressionAttributeNames: {
      '#competencies': 'competencies',
      '#updated': 'updatedAt'
    },
    ExpressionAttributeValues: {
      ':competencies': {
        questionQuality: 75,
        thinkingDepth: 80,
        creativity: 70,
        communicationClarity: 85,
        executionOriented: 80,
        collaborationSignal: 75
      },
      ':now': Date.now()
    },
    ReturnValues: 'ALL_NEW'
  }));

  expect(mockClient.send).toHaveBeenCalled();
});
```

### 4.2 복잡한 DynamoDB 쿼리 패턴

```javascript
// FilterExpression을 사용한 Scan
it('should scan with filter expression', async () => {
  const mockClient = {
    send: vi.fn().mockResolvedValue({
      Items: [
        { userId: 'user-123', role: 'ADMIN' }
      ]
    })
  };

  mockClient.send(new ScanCommand({
    TableName: 'ai-co-learner-users',
    FilterExpression: '#role = :role',
    ExpressionAttributeNames: {
      '#role': 'role'
    },
    ExpressionAttributeValues: {
      ':role': 'ADMIN'
    }
  }));

  expect(mockClient.send).toHaveBeenCalled();
});

// 배치 조회 (최근 30일)
it('should query with date range filter', async () => {
  const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);

  mockClient.send(new QueryCommand({
    TableName: 'ai-co-learner-learning-analytics',
    KeyConditionExpression: 'userId = :userId AND #timestamp > :thirtyDaysAgo',
    ExpressionAttributeNames: {
      '#timestamp': 'timestamp'
    },
    ExpressionAttributeValues: {
      ':userId': 'user-123',
      ':thirtyDaysAgo': thirtyDaysAgo
    }
  }));

  expect(mockClient.send).toHaveBeenCalled();
});
```

### 4.3 트랜잭션 (선택사항)

```javascript
// 여러 작업을 원자적으로 수행
it('should handle transactional updates', async () => {
  const mockClient = {
    send: vi.fn().mockResolvedValue({})
  };

  // TransactWriteCommand (Dynamo DB v3)
  mockClient.send({
    TransactItems: [
      {
        Put: {
          TableName: 'ai-co-learner-chat-sessions',
          Item: { sessionId: 'session-123', message: 'Hello' }
        }
      },
      {
        Update: {
          TableName: 'ai-co-learner-usage-tracking',
          Key: { userId: 'user-123' },
          UpdateExpression: 'SET #tokens = #tokens + :tokens',
          ExpressionAttributeNames: { '#tokens': 'totalTokens' },
          ExpressionAttributeValues: { ':tokens': 100 }
        }
      }
    ]
  });

  expect(mockClient.send).toHaveBeenCalled();
});
```

---

## 5. Google Gemini API 모킹

### 5.1 기본 모킹 설정

```javascript
// lambda/chat-api/__tests__/setup.mjs
import { vi } from 'vitest';

vi.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: vi.fn().mockImplementation(() => ({
    getGenerativeModel: vi.fn().mockReturnValue({
      startChat: vi.fn().mockReturnValue({
        sendMessage: vi.fn().mockResolvedValue({
          response: {
            text: () => 'Mock AI response',
            usageMetadata: {
              promptTokenCount: 50,
              candidatesTokenCount: 100,
            }
          }
        })
      })
    })
  }))
}));
```

### 5.2 스트리밍 응답 모킹

```javascript
// 스트리밍 응답은 AsyncIterable을 반환
it('should handle streaming response', async () => {
  const mockStreamChunks = [
    { text: () => 'Hello' },
    { text: () => ' ' },
    { text: () => 'world' },
    { text: () => '!' }
  ];

  const mockAsyncIterable = {
    [Symbol.asyncIterator]: async function* () {
      for (const chunk of mockStreamChunks) {
        yield chunk;
      }
    }
  };

  const mockClient = {
    getGenerativeModel: vi.fn().mockReturnValue({
      generateContentStream: vi.fn().mockResolvedValue(mockAsyncIterable)
    })
  };

  // 스트리밍 데이터 처리
  let fullResponse = '';
  for await (const chunk of mockAsyncIterable) {
    fullResponse += chunk.text();
  }

  expect(fullResponse).toBe('Hello world!');
});
```

### 5.3 다양한 Gemini 응답 시뮬레이션

**성공 응답**

```javascript
it('should handle successful Gemini response', async () => {
  mockGeminiClient.getGenerativeModel.mockReturnValue({
    startChat: vi.fn().mockReturnValue({
      sendMessage: vi.fn().mockResolvedValue({
        response: {
          text: () => '이것은 AI의 응답입니다.',
          usageMetadata: {
            promptTokenCount: 25,
            candidatesTokenCount: 50,
          }
        }
      })
    })
  });

  // 테스트 코드...
});
```

**Rate Limit 응답 (재시도 테스트)**

```javascript
it('should retry on rate limit error', async () => {
  const sendMessageFn = vi.fn()
    .mockRejectedValueOnce(
      new Error('RESOURCE_EXHAUSTED')
    )
    .mockResolvedValueOnce({
      response: {
        text: () => '재시도 후 성공',
        usageMetadata: {
          promptTokenCount: 25,
          candidatesTokenCount: 50,
        }
      }
    });

  mockGeminiClient.getGenerativeModel.mockReturnValue({
    startChat: vi.fn().mockReturnValue({
      sendMessage: sendMessageFn
    })
  });

  // retryWithBackoff를 사용한 호출 검증
  expect(sendMessageFn).toHaveBeenCalledTimes(2);
});
```

**에러 응답**

```javascript
it('should handle invalid API key error', async () => {
  mockGeminiClient.getGenerativeModel.mockReturnValue({
    startChat: vi.fn().mockReturnValue({
      sendMessage: vi.fn().mockRejectedValue(
        new Error('Invalid API key')
      )
    })
  });

  // 재시도하지 않고 즉시 실패
  // expect(response.statusCode).toBe(401 or 403);
});
```

---

## 6. 테스트 예시

### 6.1 `/chat/stream` 엔드포인트 완전 테스트

```javascript
// lambda/chat-api/__tests__/endpoints/chatStream.test.mjs
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handler } from '../../index.mjs';

vi.mock('@aws-sdk/lib-dynamodb');
vi.mock('@google/generative-ai');

describe('POST /chat/stream - 스트리밍 채팅', () => {
  let mockDynamoClient;
  let mockGeminiClient;

  beforeEach(() => {
    // DynamoDB 모킹
    mockDynamoClient = {
      send: vi.fn(),
    };

    // Gemini 모킹
    mockGeminiClient = {
      getGenerativeModel: vi.fn().mockReturnValue({
        startChat: vi.fn().mockReturnValue({
          sendMessage: vi.fn().mockResolvedValue({
            response: {
              text: () => 'How are you doing?',
              usageMetadata: {
                promptTokenCount: 50,
                candidatesTokenCount: 75,
              }
            }
          })
        })
      })
    };

    // 모듈 초기화
    vi.resetModules();
  });

  describe('성공 시나리오', () => {
    it('should stream chat response with CORS headers', async () => {
      // Setup 데이터
      const sessionId = 'session-123';
      const userId = 'user-123';
      const botId = 'bot-456';
      const userMessage = 'Hello, AI!';

      // Mock 응답 설정
      // 1. 봇 템플릿 조회
      mockDynamoClient.send
        .mockResolvedValueOnce({
          Items: [{
            templateId: 'template-1',
            systemPrompt: 'You are a helpful assistant'
          }]
        })
        // 2. 사용자 봇 조회
        .mockResolvedValueOnce({
          Items: [{
            botId,
            templateId: 'template-1'
          }]
        })
        // 3. 대화 히스토리 조회
        .mockResolvedValueOnce({
          Items: []
        })
        // 4. 메시지 저장
        .mockResolvedValueOnce({})
        // 5. 사용량 추적
        .mockResolvedValueOnce({});

      // 요청 구성
      const event = {
        httpMethod: 'POST',
        path: '/chat/stream',
        body: JSON.stringify({
          userId,
          sessionId,
          botId,
          message: userMessage
        })
      };

      // 핸들러 호출
      const response = await handler(event);

      // 검증 1: 상태 코드
      expect(response.statusCode).toBe(200);

      // 검증 2: CORS 헤더
      expect(response.headers['Access-Control-Allow-Origin']).toBe('*');
      expect(response.headers['Content-Type']).toBe('application/json');

      // 검증 3: 응답 본문
      const body = JSON.parse(response.body);
      expect(body.message).toBe('How are you doing?');
      expect(body.tokens).toEqual({
        input: 50,
        output: 75,
        total: 125
      });

      // 검증 4: DynamoDB 호출 횟수
      expect(mockDynamoClient.send).toHaveBeenCalledTimes(5);
    });

    it('should handle conversation history properly', async () => {
      // 이전 대화 히스토리가 있는 경우
      mockDynamoClient.send
        .mockResolvedValueOnce({ Items: [] }) // 템플릿
        .mockResolvedValueOnce({ Items: [{ botId: 'bot-456', templateId: 'template-1' }] }) // 봇
        .mockResolvedValueOnce({
          Items: [
            {
              sessionId: 'session-123',
              timestamp: Date.now() - 60000,
              userMessage: 'Previous message',
              aiMessage: 'Previous response'
            }
          ]
        })
        .mockResolvedValueOnce({}) // 메시지 저장
        .mockResolvedValueOnce({}); // 사용량 추적

      const event = {
        httpMethod: 'POST',
        path: '/chat/stream',
        body: JSON.stringify({
          userId: 'user-123',
          sessionId: 'session-123',
          botId: 'bot-456',
          message: 'Follow-up message'
        })
      };

      const response = await handler(event);

      expect(response.statusCode).toBe(200);
      // Gemini는 이전 대화를 포함하여 호출됨
      expect(mockGeminiClient.getGenerativeModel).toHaveBeenCalled();
    });
  });

  describe('에러 시나리오', () => {
    it('should return 400 for missing required fields', async () => {
      const event = {
        httpMethod: 'POST',
        path: '/chat/stream',
        body: JSON.stringify({
          userId: 'user-123'
          // sessionId, message 누락
        })
      };

      const response = await handler(event);

      // 검증: 400 Bad Request
      expect(response.statusCode).toBe(400);
      expect(response.headers['Access-Control-Allow-Origin']).toBe('*');

      const body = JSON.parse(response.body);
      expect(body.error).toContain('Missing required fields');
    });

    it('should return 404 when bot not found', async () => {
      mockDynamoClient.send
        .mockResolvedValueOnce({ Items: [] }) // 템플릿
        .mockResolvedValueOnce({ Items: [] }); // 사용자 봇 없음

      const event = {
        httpMethod: 'POST',
        path: '/chat/stream',
        body: JSON.stringify({
          userId: 'user-123',
          sessionId: 'session-123',
          message: 'Hello'
        })
      };

      const response = await handler(event);

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.error).toContain('Bot not found');
    });

    it('should retry on Gemini rate limit error', async () => {
      mockDynamoClient.send
        .mockResolvedValueOnce({ Items: [{ templateId: 'template-1', systemPrompt: 'Prompt' }] })
        .mockResolvedValueOnce({ Items: [{ botId: 'bot-456', templateId: 'template-1' }] })
        .mockResolvedValueOnce({ Items: [] })
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({});

      // Gemini: 첫 시도 실패, 두 번째 성공
      const sendMessageFn = vi.fn()
        .mockRejectedValueOnce(new Error('RESOURCE_EXHAUSTED'))
        .mockResolvedValueOnce({
          response: {
            text: () => 'Retry success',
            usageMetadata: {
              promptTokenCount: 50,
              candidatesTokenCount: 75,
            }
          }
        });

      mockGeminiClient.getGenerativeModel.mockReturnValue({
        startChat: vi.fn().mockReturnValue({
          sendMessage: sendMessageFn
        })
      });

      const event = {
        httpMethod: 'POST',
        path: '/chat/stream',
        body: JSON.stringify({
          userId: 'user-123',
          sessionId: 'session-123',
          message: 'Hello'
        })
      };

      const response = await handler(event);

      // 재시도 후 최종 성공
      expect(response.statusCode).toBe(200);
      expect(sendMessageFn).toHaveBeenCalledTimes(2);
    });

    it('should return 500 on unexpected error', async () => {
      mockDynamoClient.send
        .mockRejectedValue(new Error('DynamoDB connection failed'));

      const event = {
        httpMethod: 'POST',
        path: '/chat/stream',
        body: JSON.stringify({
          userId: 'user-123',
          sessionId: 'session-123',
          message: 'Hello'
        })
      };

      const response = await handler(event);

      expect(response.statusCode).toBe(500);
      expect(response.headers['Access-Control-Allow-Origin']).toBe('*');

      const body = JSON.parse(response.body);
      expect(body.error).toContain('DynamoDB');
    });
  });

  describe('CORS 헤더 검증', () => {
    it('should always include CORS headers', async () => {
      const scenarios = [
        { statusCode: 200, description: '성공' },
        { statusCode: 400, description: '입력값 오류' },
        { statusCode: 500, description: '서버 오류' }
      ];

      for (const scenario of scenarios) {
        // 각 시나리오에 대해 요청 실행
        // ...

        // CORS 헤더 검증
        expect(response.headers['Access-Control-Allow-Origin']).toBe('*');
        expect(response.headers['Access-Control-Allow-Headers']).toContain('Content-Type');
        expect(response.headers['Access-Control-Allow-Methods']).toContain('POST');
      }
    });
  });
});
```

### 6.2 `/users/{userId}` 엔드포인트 테스트

```javascript
// lambda/chat-api/__tests__/endpoints/getUser.test.mjs
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handler } from '../../index.mjs';

vi.mock('@aws-sdk/lib-dynamodb');

describe('GET /users/{userId} - 사용자 프로필 조회', () => {
  let mockDynamoClient;

  beforeEach(() => {
    mockDynamoClient = {
      send: vi.fn(),
    };
  });

  it('should return user profile with competencies', async () => {
    const userId = 'user-123';

    mockDynamoClient.send
      // 사용자 프로필
      .mockResolvedValueOnce({
        Item: {
          userId,
          username: 'testuser',
          name: 'Test User',
          organization: 'Test School',
          role: 'USER',
          level: 5,
          title: '숙련된 탐험가',
          createdAt: Date.now()
        }
      })
      // 역량 데이터
      .mockResolvedValueOnce({
        Item: {
          userId,
          competencies: {
            questionQuality: 75,
            thinkingDepth: 80,
            creativity: 70,
            communicationClarity: 85,
            executionOriented: 80,
            collaborationSignal: 75
          },
          updatedAt: Date.now()
        }
      });

    const event = {
      httpMethod: 'GET',
      path: `/users/${userId}`,
    };

    const response = await handler(event);

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);

    expect(body.userId).toBe(userId);
    expect(body.username).toBe('testuser');
    expect(body.competencies.questionQuality).toBe(75);
  });

  it('should return 404 when user not found', async () => {
    mockDynamoClient.send.mockResolvedValue({ Item: null });

    const event = {
      httpMethod: 'GET',
      path: '/users/nonexistent-user',
    };

    const response = await handler(event);

    expect(response.statusCode).toBe(404);
    expect(response.headers['Access-Control-Allow-Origin']).toBe('*');
  });
});
```

### 6.3 권한 검증 테스트

```javascript
// lambda/chat-api/__tests__/endpoints/adminOnly.test.mjs
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handler } from '../../index.mjs';

vi.mock('@aws-sdk/lib-dynamodb');

describe('Admin Only Endpoints - 권한 검증', () => {
  let mockDynamoClient;

  beforeEach(() => {
    mockDynamoClient = {
      send: vi.fn(),
    };
  });

  it('should allow ADMIN to create template', async () => {
    mockDynamoClient.send
      // 권한 체크: ADMIN 사용자
      .mockResolvedValueOnce({
        Item: { userId: 'admin-123', role: 'ADMIN' }
      })
      // 템플릿 생성
      .mockResolvedValueOnce({});

    const event = {
      httpMethod: 'POST',
      path: '/admin/templates/create',
      body: JSON.stringify({
        userId: 'admin-123',
        templateId: 'new-template',
        botName: 'New Bot',
        systemPrompt: 'You are helpful'
      })
    };

    const response = await handler(event);

    expect(response.statusCode).toBe(201);
  });

  it('should deny USER from creating template', async () => {
    mockDynamoClient.send
      // 권한 체크: USER 사용자 (ADMIN 아님)
      .mockResolvedValueOnce({
        Item: { userId: 'user-123', role: 'USER' }
      });

    const event = {
      httpMethod: 'POST',
      path: '/admin/templates/create',
      body: JSON.stringify({
        userId: 'user-123',
        templateId: 'new-template',
        botName: 'New Bot'
      })
    };

    const response = await handler(event);

    expect(response.statusCode).toBe(403);
    const body = JSON.parse(response.body);
    expect(body.error).toContain('Access denied');
    expect(body.error).toContain('ADMIN');
  });

  it('should deny when user not found', async () => {
    mockDynamoClient.send
      // 권한 체크: 사용자 없음
      .mockResolvedValueOnce({ Item: null });

    const event = {
      httpMethod: 'POST',
      path: '/admin/templates/create',
      body: JSON.stringify({
        userId: 'unknown-user',
        templateId: 'new-template'
      })
    };

    const response = await handler(event);

    expect(response.statusCode).toBe(403);
  });
});
```

---

## 7. 테스트 실행 방법

### 7.1 npm scripts 설정

```json
// lambda/chat-api/package.json
{
  "scripts": {
    "test": "vitest",
    "test:watch": "vitest --watch",
    "test:coverage": "vitest --coverage",
    "test:ui": "vitest --ui",
    "test:debug": "vitest --inspect-brk --inspect --single-thread"
  },
  "devDependencies": {
    "vitest": "^1.0.0",
    "@vitest/ui": "^1.0.0",
    "@vitest/coverage-v8": "^1.0.0"
  }
}
```

### 7.2 테스트 실행

```bash
# 모든 테스트 실행
npm test

# Watch 모드 (파일 변경 시 자동 실행)
npm run test:watch

# 커버리지 리포트 생성
npm run test:coverage

# UI 대시보드 (브라우저에서 테스트 결과 확인)
npm run test:ui

# 디버그 모드 (Node debugger 연결)
npm run test:debug
```

### 7.3 테스트 커버리지 확인

```bash
# 커버리지 리포트 출력
npm run test:coverage

# 출력 예:
# ✓ src/utils/retry.test.mjs (3)
# ✓ src/utils/auth.test.mjs (5)
#
# Test Files  2 passed (2)
#      Tests  8 passed (8)
#
# % Coverage report from v8
# ----------|---------|---------|---------|---------|
# File      | % Stmts | % Branches | % Funcs | % Lines |
# ----------|---------|---------|---------|---------|
# All files |   85.5  |   82.3    |   90.0  |   85.2  |
```

---

## 8. CI/CD 통합

### 8.1 GitHub Actions 예시

```yaml
# .github/workflows/lambda-test.yml
name: Lambda Function Tests

on:
  push:
    branches: [main, develop]
    paths:
      - 'lambda/**'
  pull_request:
    branches: [main, develop]
    paths:
      - 'lambda/**'

jobs:
  test:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        node-version: [18.x, 20.x]

    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: ${{ matrix.node-version }}
          cache: 'npm'

      - name: Install dependencies (chat-api)
        run: cd lambda/chat-api && npm install

      - name: Run tests (chat-api)
        run: cd lambda/chat-api && npm test

      - name: Generate coverage (chat-api)
        run: cd lambda/chat-api && npm run test:coverage

      - name: Upload coverage to Codecov
        uses: codecov/codecov-action@v3
        with:
          files: ./lambda/chat-api/coverage/coverage-final.json
          flags: lambda-chat-api
          fail_ci_if_error: false

      - name: Build deployment package
        run: cd lambda/chat-api && npm run build

      - name: Comment PR with test results
        if: github.event_name == 'pull_request'
        uses: actions/github-script@v6
        with:
          script: |
            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: '✅ Lambda 테스트 완료\n\n- 모든 테스트 통과\n- 커버리지: 85%+\n- 배포 패키지 생성 완료'
            })
```

### 8.2 Pre-commit Hook (husky)

```bash
# 설치
npm install husky --save-dev
npx husky install

# .husky/pre-commit 생성
#!/bin/sh
. "$(dirname "$0")/_/husky.sh"

cd lambda/chat-api
npm test
```

---

## 9. 모범 사례

### 9.1 Given-When-Then 패턴

```javascript
describe('getUserProfile', () => {
  it('should return user profile with all fields', () => {
    // Given: 특정 사용자 ID가 주어졌을 때
    const userId = 'user-123';

    mockDynamoClient.send.mockResolvedValue({
      Item: {
        userId,
        username: 'testuser',
        name: 'Test User'
      }
    });

    // When: 사용자 프로필을 조회하면
    const result = getUserProfile(userId);

    // Then: 완전한 사용자 정보가 반환되어야 함
    expect(result).toEqual(expect.objectContaining({
      userId: 'user-123',
      username: 'testuser'
    }));
  });
});
```

### 9.2 AAA (Arrange-Act-Assert) 패턴

```javascript
it('should save and retrieve chat message', async () => {
  // Arrange: 테스트 데이터 준비
  const sessionId = 'session-123';
  const message = 'Hello, AI!';
  const timestamp = Date.now();

  mockDynamoClient.send
    .mockResolvedValueOnce({}) // 저장 성공
    .mockResolvedValueOnce({   // 조회 성공
      Items: [{
        sessionId,
        userMessage: message,
        timestamp
      }]
    });

  // Act: 테스트 대상 함수 실행
  await saveChatMessage(sessionId, message);
  const retrieved = await getChatHistory(sessionId);

  // Assert: 결과 검증
  expect(retrieved).toHaveLength(1);
  expect(retrieved[0].userMessage).toBe(message);
});
```

### 9.3 테스트 독립성 유지

```javascript
describe('User Service', () => {
  beforeEach(() => {
    // 각 테스트 전에 모든 mock을 초기화
    vi.clearAllMocks();

    // 타이머 초기화 (fake timers 사용 시)
    vi.useFakeTimers();
  });

  afterEach(() => {
    // 타이머 복원
    vi.useRealTimers();
  });

  it('Test 1: should not affect Test 2', () => {
    // Test 1의 state
  });

  it('Test 2: should run independently', () => {
    // Test 2는 Test 1의 영향을 받지 않음
  });
});
```

### 9.4 명확한 테스트 네이밍

```javascript
// ❌ 나쁜 예
it('should work', () => { ... });

// ❌ 나쁜 예
it('test getUserData', () => { ... });

// ✅ 좋은 예
it('should return user profile when valid userId is provided', () => { ... });

// ✅ 좋은 예
it('should throw error when DynamoDB connection fails', () => { ... });

// ✅ 좋은 예
it('should retry 3 times before giving up on rate limit', () => { ... });
```

### 9.5 테스트 그룹화

```javascript
describe('Chat API', () => {
  describe('POST /chat/stream', () => {
    describe('with valid input', () => {
      it('should return 200 with streaming response', () => { ... });
      it('should save message to database', () => { ... });
      it('should track token usage', () => { ... });
    });

    describe('with invalid input', () => {
      it('should return 400 for missing fields', () => { ... });
      it('should return 400 for empty message', () => { ... });
    });

    describe('with DynamoDB errors', () => {
      it('should return 500 on connection failure', () => { ... });
      it('should not retry on validation error', () => { ... });
    });

    describe('with Gemini API errors', () => {
      it('should retry on rate limit', () => { ... });
      it('should fail on invalid API key', () => { ... });
    });
  });

  describe('GET /users/{userId}', () => {
    // ...
  });
});
```

---

## 10. 트러블슈팅

### 10.1 ESM vs CommonJS 이슈

**문제**: Lambda 함수는 ESM (`index.mjs`)이지만 테스트가 CommonJS로 실행되는 경우

**해결책**:

```javascript
// vitest.config.mjs (ESM 설정)
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    pool: 'forks', // 각 테스트를 별도 프로세스에서 실행
    poolOptions: {
      forks: {
        singleFork: true, // 단일 포크 사용
      }
    }
  }
});
```

### 10.2 비동기 처리 이슈

**문제**: async/await 함수 테스트 시 Promise가 완료되지 않은 상태로 테스트 종료

**해결책**:

```javascript
// ❌ 잘못된 예
it('should fetch data', () => {
  getUserData().then(data => {
    expect(data).toBeDefined();
  });
});

// ✅ 올바른 예
it('should fetch data', async () => {
  const data = await getUserData();
  expect(data).toBeDefined();
});

// ✅ 또 다른 올바른 예
it('should fetch data', () => {
  return getUserData().then(data => {
    expect(data).toBeDefined();
  });
});
```

### 10.3 타이머 관련 이슈

**문제**: `setTimeout`이나 `setInterval`을 사용하는 코드 테스트

**해결책**:

```javascript
import { beforeEach, afterEach, vi } from 'vitest';

describe('Retry Logic', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should wait correct amount of time', async () => {
    const fn = vi.fn().mockRejectedValueOnce(new Error('timeout'));

    const promise = retryWithBackoff(fn, 1);

    // 1000ms 지나감
    vi.advanceTimersByTime(1000);

    await promise;

    expect(fn).toHaveBeenCalledTimes(2);
  });
});
```

### 10.4 모듈 모킹이 작동하지 않는 경우

**문제**: `vi.mock()`이 작동하지 않음

**원인**: 모킹은 모듈 로드 전에 수행되어야 함

**해결책**:

```javascript
// ❌ 잘못된 예
import { handler } from '../index.mjs';
import { GoogleGenerativeAI } from '@google/generative-ai';

vi.mock('@google/generative-ai');

// ✅ 올바른 예
vi.mock('@google/generative-ai');
vi.mock('@aws-sdk/lib-dynamodb');

import { handler } from '../index.mjs';
```

### 10.5 메모리 누수 방지

**문제**: 테스트 후 모의 객체가 메모리에 남음

**해결책**:

```javascript
beforeEach(() => {
  vi.clearAllMocks();      // 모든 mock 호출 기록 제거
});

afterEach(() => {
  vi.resetAllMocks();      // 모든 mock 리셋
  vi.restoreAllMocks();    // 모든 spy 복원
});
```

### 10.6 CORS 헤더 누락 확인

**문제**: 에러 응답에서 CORS 헤더가 누락됨

**확인 방법**:

```javascript
it('should include CORS headers in error response', async () => {
  const event = {
    httpMethod: 'POST',
    path: '/chat/stream',
    body: '{}' // 유효하지 않은 JSON
  };

  const response = await handler(event);

  // 모든 응답에 CORS 헤더가 있어야 함
  expect(response.headers).toBeDefined();
  expect(response.headers['Access-Control-Allow-Origin']).toBe('*');
  expect(response.headers['Access-Control-Allow-Headers']).toBeDefined();
  expect(response.headers['Access-Control-Allow-Methods']).toBeDefined();
});
```

### 10.7 스트리밍 응답 파싱 이슈

**문제**: newline-delimited JSON 파싱 오류

**테스트**:

```javascript
it('should parse streaming response correctly', async () => {
  const responseBody = 'data: {"chunk":"Hello"}\ndata: {"chunk":" world"}\n';

  const lines = responseBody.trim().split('\n');
  const chunks = lines
    .map(line => {
      const match = line.match(/^data: (.+)$/);
      return match ? JSON.parse(match[1]) : null;
    })
    .filter(Boolean);

  expect(chunks).toEqual([
    { chunk: 'Hello' },
    { chunk: ' world' }
  ]);
});
```

---

## 11. 추가 자료

### 11.1 관련 문서
- [AWS Architecture Guide](./aws-architecture.md) - Lambda 함수 구조
- [Lambda Environment Variables](./lambda-environment-variables.md) - 환경 변수 설정
- [CloudWatch Monitoring](./cloudwatch-monitoring-guide.md) - 로그 모니터링

### 11.2 외부 자료
- [Vitest Documentation](https://vitest.dev/)
- [AWS SDK v3 Testing](https://docs.aws.amazon.com/sdk-for-javascript/v3/developer-guide/)
- [Google Generative AI Testing](https://ai.google.dev/tutorials)

### 11.3 팀 체크리스트

- [ ] 모든 Lambda 함수에 단위 테스트 작성
- [ ] 주요 엔드포인트에 통합 테스트 작성
- [ ] E2E 테스트로 전체 흐름 검증
- [ ] 테스트 커버리지 80% 이상 유지
- [ ] CI/CD 파이프라인에 자동 테스트 통합
- [ ] Pre-commit hook으로 로컬 테스트 실행
- [ ] 새로운 엔드포인트 추가 시 테스트 우선 작성 (TDD)

---

**마지막 업데이트**: 2025-12-31
**작성자**: AI Co-Learner 개발팀
**버전**: 1.0.0
