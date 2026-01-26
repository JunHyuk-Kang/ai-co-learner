import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { Loader2 } from 'lucide-react';

export const Login: React.FC = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [organization, setOrganization] = useState('');
  const [confirmationCode, setConfirmationCode] = useState('');
  const [needsConfirmation, setNeedsConfirmation] = useState(false);
  const [pendingUsername, setPendingUsername] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const { login, signup, confirmSignup, isLoading, user } = useAuth();
  const navigate = useNavigate();

  // 이미 로그인된 경우 대시보드로 리다이렉트
  useEffect(() => {
    if (user) {
      navigate('/');
    }
  }, [user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    try {
      if (isLogin) {
        await login(username, password);
      } else {
        const result = await signup(username, password, name, organization);
        if (result.needsConfirmation) {
          setNeedsConfirmation(true);
          setPendingUsername(result.username || username);
          setSuccess('회원가입이 완료되었습니다. 이메일로 전송된 인증 코드를 입력해주세요.');
        }
      }
      // user 상태가 업데이트되면 useEffect가 자동으로 리다이렉트
    } catch (error) {
      setError(error instanceof Error ? error.message : '오류가 발생했습니다.');
    }
  };

  const handleConfirmation = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    try {
      await confirmSignup(pendingUsername, confirmationCode);
      setSuccess('이메일 인증이 완료되었습니다. 로그인해주세요.');
      setNeedsConfirmation(false);
      setIsLogin(true);
      setConfirmationCode('');
    } catch (error) {
      setError(error instanceof Error ? error.message : '인증 코드 확인 중 오류가 발생했습니다.');
    }
  };

  return (
    <div className="min-h-screen bg-[#121212] flex items-center justify-center p-4 relative overflow-y-auto">
      {/* Background decoration */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-primary/5 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-md w-full bg-surface border border-border p-8 rounded-2xl shadow-2xl relative z-10">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">AI Co-Learner</h1>
          <p className="text-gray-400">생각의 힘을 기르는 AI 파트너</p>
        </div>

        {error && (
          <div className="mb-4 p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
            <p className="text-sm text-red-300">{error}</p>
          </div>
        )}

        {success && (
          <div className="mb-4 p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
            <p className="text-sm text-green-300">{success}</p>
          </div>
        )}

        {needsConfirmation ? (
          <form onSubmit={handleConfirmation} className="space-y-4">
            <div className="mb-4 p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
              <p className="text-sm text-blue-300">
                {pendingUsername}님의 이메일로 인증 코드를 전송했습니다.
              </p>
            </div>

            <Input
              label="인증 코드"
              placeholder="6자리 인증 코드를 입력하세요"
              value={confirmationCode}
              onChange={e => setConfirmationCode(e.target.value)}
              required
            />

            <Button type="submit" className="w-full mt-6" disabled={isLoading}>
              {isLoading ? <Loader2 className="animate-spin mr-2" size={18} /> : null}
              인증 완료
            </Button>

            <button
              type="button"
              onClick={() => {
                setNeedsConfirmation(false);
                setIsLogin(true);
              }}
              className="w-full text-xs text-gray-500 hover:text-primary transition-colors mt-2"
            >
              이미 인증하셨나요? 로그인
            </button>
          </form>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="아이디"
              placeholder="아이디를 입력하세요"
              value={username}
              onChange={e => setUsername(e.target.value)}
              required
            />

            <Input
              label="비밀번호"
              type="password"
              placeholder="비밀번호를 입력하세요"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
            />

            {!isLogin && (
              <>
                <div className="text-xs text-gray-500 -mt-2 mb-2">
                  <p>비밀번호는 다음 조건을 만족해야 합니다:</p>
                  <ul className="list-disc list-inside ml-2 mt-1 space-y-1">
                    <li>최소 8자 이상</li>
                    <li>숫자 포함</li>
                    <li>대문자 포함</li>
                    <li>소문자 포함</li>
                    <li>특수문자 포함</li>
                  </ul>
                </div>

                <Input
                  label="이름"
                  placeholder="이름을 입력하세요"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  required
                />

                <Input
                  label="소속"
                  placeholder="소속을 입력하세요 (예: ABC 회사, XYZ 대학교)"
                  value={organization}
                  onChange={e => setOrganization(e.target.value)}
                  required
                />
              </>
            )}

            <Button type="submit" className="w-full mt-6" disabled={isLoading}>
              {isLoading ? <Loader2 className="animate-spin mr-2" size={18} /> : null}
              {isLogin ? '로그인' : '회원가입'}
            </Button>
          </form>
        )}

        <div className="mt-6 text-center">
          <button
            type="button"
            onClick={() => setIsLogin(!isLogin)}
            className="text-xs text-gray-500 hover:text-primary transition-colors"
          >
            {isLogin ? '계정이 없으신가요? 회원가입' : '이미 계정이 있으신가요? 로그인'}
          </button>
        </div>

        <div className="mt-8 p-4 bg-[#121212] rounded-lg border border-border text-xs text-gray-500">
          <p className="font-semibold mb-1">AWS Cognito 인증:</p>
          <p>회원가입 후 자동으로 로그인됩니다.</p>
        </div>
      </div>
    </div>
  );
};
