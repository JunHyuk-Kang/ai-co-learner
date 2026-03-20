# 사용량 대시보드 트러블슈팅 가이드

## ✅ 해결된 문제들

### 1️⃣ Admin 페이지에서 "사용량 & 비용" 탭이 안 보이는 문제

**원인**: API Gateway에 `/admin/usage` 라우트가 없었음

**해결**:
```bash
# 1. /admin/usage 리소스 생성
aws apigateway create-resource \
  --rest-api-id oz20zs5lfc \
  --parent-id 5aclt9 \
  --path-part usage \
  --region ap-northeast-2

# 2. GET 메서드 추가
aws apigateway put-method \
  --rest-api-id oz20zs5lfc \
  --resource-id wkvr8a \
  --http-method GET \
  --authorization-type NONE \
  --region ap-northeast-2

# 3. OPTIONS 메서드 추가 (CORS)
aws apigateway put-method \
  --rest-api-id oz20zs5lfc \
  --resource-id wkvr8a \
  --http-method OPTIONS \
  --authorization-type NONE \
  --region ap-northeast-2

# 4. Lambda 통합
aws apigateway put-integration \
  --rest-api-id oz20zs5lfc \
  --resource-id wkvr8a \
  --http-method GET \
  --type AWS_PROXY \
  --integration-http-method POST \
  --uri "arn:aws:apigateway:ap-northeast-2:lambda:path/2015-03-31/functions/arn:aws:lambda:ap-northeast-2:144414543539:function:ai-co-learner-chat/invocations" \
  --region ap-northeast-2

# 5. CORS 설정
aws apigateway put-integration \
  --rest-api-id oz20zs5lfc \
  --resource-id wkvr8a \
  --http-method OPTIONS \
  --type MOCK \
  --request-templates '{"application/json":"{\"statusCode\": 200}"}' \
  --region ap-northeast-2

# 6. 배포
aws apigateway create-deployment \
  --rest-api-id oz20zs5lfc \
  --stage-name prod \
  --region ap-northeast-2
```

---

### 2️⃣ CORS 에러 문제

**원인**:
- Lambda 함수에서 CORS 헤더를 반환했지만, API Gateway에서 OPTIONS 메서드 설정이 누락됨
- 새로운 라우트 추가 시 CORS 설정을 하지 않음

**해결**:
모든 `/admin/*` 라우트에 OPTIONS 메서드와 CORS 헤더 추가

```bash
# OPTIONS 메서드 응답 설정
aws apigateway put-method-response \
  --rest-api-id oz20zs5lfc \
  --resource-id wkvr8a \
  --http-method OPTIONS \
  --status-code 200 \
  --response-parameters '{"method.response.header.Access-Control-Allow-Headers":true,"method.response.header.Access-Control-Allow-Methods":true,"method.response.header.Access-Control-Allow-Origin":true}' \
  --region ap-northeast-2

# OPTIONS 통합 응답 설정
aws apigateway put-integration-response \
  --rest-api-id oz20zs5lfc \
  --resource-id wkvr8a \
  --http-method OPTIONS \
  --status-code 200 \
  --response-parameters '{"method.response.header.Access-Control-Allow-Headers":"'\''Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'\''","method.response.header.Access-Control-Allow-Methods":"'\''GET,OPTIONS'\''","method.response.header.Access-Control-Allow-Origin":"'\''*'\''"}' \
  --region ap-northeast-2
```

---

## 🔧 CORS 설정 체크리스트

새로운 API 라우트를 추가할 때마다 다음을 확인하세요:

### ✅ Lambda 함수 (이미 완료)
```javascript
const CORS_HEADERS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token",
  "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS"
};

// 모든 응답에 포함
return {
  statusCode: 200,
  headers: CORS_HEADERS,
  body: JSON.stringify(data)
};
```

### ✅ API Gateway (수동 설정 필요)
1. **OPTIONS 메서드 생성**
2. **MOCK 통합 추가**
3. **메서드 응답 설정**
4. **통합 응답 설정**
5. **배포**

---

## 🧪 테스트 방법

### 1. 브라우저 콘솔에서 테스트
```javascript
fetch('https://oz20zs5lfc.execute-api.ap-northeast-2.amazonaws.com/prod/admin/usage?days=30', {
  method: 'GET',
  headers: {
    'Content-Type': 'application/json'
  }
})
.then(res => res.json())
.then(data => console.log(data))
.catch(err => console.error(err));
```

### 2. test-usage-api.html 파일 사용
프로젝트 루트의 `test-usage-api.html` 파일을 브라우저로 열고 "Test API" 버튼 클릭

### 3. curl로 테스트
```bash
curl -X GET "https://oz20zs5lfc.execute-api.ap-northeast-2.amazonaws.com/prod/admin/usage?days=30" \
  -H "Content-Type: application/json"
```

---

## 📋 현재 API Gateway 라우트 목록

### Admin 라우트
- ✅ `GET /admin/users` - 전체 사용자 조회
- ✅ `POST /admin/users/update-role` - 사용자 역할 변경
- ✅ `POST /admin/users/block` - 사용자 차단
- ✅ `POST /admin/templates/create` - 템플릿 생성
- ✅ `POST /admin/templates/update` - 템플릿 수정
- ✅ `POST /admin/templates/delete` - 템플릿 삭제
- ✅ `GET /admin/usage` ⭐ **NEW!** - 사용량 통계 조회

### 모든 라우트에 OPTIONS 메서드 있음 (CORS)

---

## ⚠️ 주의사항

### 새 라우트 추가 시 반드시:
1. Lambda 함수에서 라우팅 로직 추가
2. API Gateway에 리소스 생성
3. GET/POST 메서드 추가
4. **OPTIONS 메서드 추가** (CORS)
5. Lambda 통합 설정
6. **CORS 헤더 설정**
7. **배포**

### CORS 에러 발생 시:
1. Lambda 로그 확인
2. API Gateway OPTIONS 메서드 확인
3. 브라우저 개발자 도구 Network 탭 확인
4. 배포 확인 (`create-deployment` 실행)

---

## 🎉 완료!

이제 Admin 페이지에서:
- ✅ "사용량 & 비용" 탭 클릭 가능
- ✅ CORS 에러 없이 데이터 로드
- ✅ 실시간 사용량 및 비용 확인

**문제 발생 시 이 문서를 참고하세요!**
