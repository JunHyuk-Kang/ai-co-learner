@echo off
REM Lambda Layer 의존성 설치 스크립트 (Windows)
REM Node.js Layer 구조: nodejs/node_modules/

echo ========================================
echo Lambda Layer 의존성 설치 시작
echo ========================================

REM nodejs 디렉토리 생성 (Layer 표준 구조)
if not exist nodejs mkdir nodejs
cd nodejs

REM package.json 복사
copy ..\package.json package.json

REM 의존성 설치
echo.
echo [1/2] npm install 실행 중...
call npm install --production

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ERROR] npm install 실패
    cd ..
    exit /b 1
)

echo.
echo [2/2] 설치 완료
echo.

REM 설치된 패키지 확인
echo ========================================
echo 설치된 패키지:
echo ========================================
dir /b node_modules\@aws-sdk

cd ..

echo.
echo ========================================
echo Lambda Layer 설치 완료!
echo ========================================
echo.
echo 다음 단계: deploy.bat 실행
echo.
