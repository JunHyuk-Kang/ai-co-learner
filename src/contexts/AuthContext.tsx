import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import {
  signUp,
  signIn,
  signOut,
  getCurrentUser,
  confirmSignUp,
  fetchUserAttributes,
  fetchAuthSession,
} from 'aws-amplify/auth';
import { User } from '../types';
import { UserService } from '../services/awsBackend';
import { logger } from '../utils/logger';

interface AuthContextType {
  user: User | null;
  login: (username: string, password: string) => Promise<void>;
  signup: (
    username: string,
    password: string,
    name: string,
    organization?: string
  ) => Promise<{ needsConfirmation: boolean; username?: string }>;
  confirmSignup: (username: string, code: string) => Promise<void>;
  logout: () => Promise<void>;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// 토큰 갱신 체크 간격: 5분 (밀리초)
const TOKEN_CHECK_INTERVAL = 5 * 60 * 1000;

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const sessionCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // 토큰 유효성 체크
  const checkTokenValidity = async (): Promise<boolean> => {
    try {
      const session = await fetchAuthSession();
      const tokens = session.tokens;

      if (!tokens || !tokens.accessToken) {
        logger.debug('No tokens found');
        return false;
      }

      // 토큰이 만료되었는지 확인
      const payload = tokens.accessToken.payload;
      const expirationTime = payload?.exp as number | undefined;

      if (!expirationTime) {
        logger.debug('No expiration time in token');
        return false;
      }

      const currentTime = Math.floor(Date.now() / 1000);

      if (expirationTime <= currentTime) {
        logger.debug('Token expired');
        return false;
      }

      return true;
    } catch (error) {
      logger.error('Token check error:', error);
      return false;
    }
  };

  // 세션 체크 및 자동 로그아웃
  const checkSession = async () => {
    const isValid = await checkTokenValidity();
    if (!isValid && user) {
      logger.info('Session expired, logging out');
      await logout();
      alert('세션이 만료되었습니다. 다시 로그인해주세요.');
    }
  };

  // 세션 체크 인터벌 시작
  const startSessionCheck = () => {
    // 기존 인터벌이 있으면 제거
    if (sessionCheckIntervalRef.current) {
      clearInterval(sessionCheckIntervalRef.current);
    }

    // 새로운 인터벌 설정
    sessionCheckIntervalRef.current = setInterval(() => {
      checkSession();
    }, TOKEN_CHECK_INTERVAL);
  };

  // 세션 체크 인터벌 중지
  const stopSessionCheck = () => {
    if (sessionCheckIntervalRef.current) {
      clearInterval(sessionCheckIntervalRef.current);
      sessionCheckIntervalRef.current = null;
    }
  };

  const fetchCurrentUser = async () => {
    try {
      const currentUser = await getCurrentUser();

      // 토큰 유효성 체크
      const isValid = await checkTokenValidity();
      if (!isValid) {
        setUser(null);
        return;
      }

      // DynamoDB에서 사용자 프로필 가져오기
      const userProfile = await UserService.getUserProfile(currentUser.userId);

      if (userProfile) {
        // 프로필이 있지만 name이 userId처럼 보이면 수정
        const userAttributes = await fetchUserAttributes();

        const cognitoName = userAttributes.name || currentUser.username;

        // name이 UUID 형태(userId)이고 Cognito에 실제 이름이 있으면 업데이트
        if (userProfile.name === currentUser.userId && cognitoName !== currentUser.userId) {
          const updatedProfile = await UserService.updateUserProfile(
            currentUser.userId,
            cognitoName
          );
          setUser(updatedProfile);
        } else {
          setUser(userProfile);
        }
      } else {
        // 프로필이 없으면 Cognito 속성에서 이름 가져오기
        const userAttributes = await fetchUserAttributes();

        const displayName = userAttributes.name || currentUser.username;

        const newProfile = await UserService.createUserProfile(
          currentUser.userId,
          currentUser.username,
          displayName
        );
        setUser(newProfile);
      }

      // 세션 체크 시작
      startSessionCheck();
    } catch (error) {
      logger.error('Error fetching user:', error);
      setUser(null);
      stopSessionCheck();
    }
  };

  const login = async (username: string, password: string) => {
    setIsLoading(true);
    try {
      // 기존 세션이 있으면 먼저 로그아웃
      try {
        await getCurrentUser();
        await signOut();
      } catch {
        // 세션이 없으면 무시
      }

      await signIn({ username, password });

      // signIn이 성공하면 토큰이 준비될 때까지 잠시 대기
      await new Promise(resolve => setTimeout(resolve, 500));

      await fetchCurrentUser();
    } catch (error) {
      logger.error('Login error:', error);
      throw new Error(error instanceof Error ? error.message : '로그인 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  const signup = async (
    username: string,
    password: string,
    name: string,
    organization?: string
  ) => {
    setIsLoading(true);
    try {
      // Cognito에 회원가입
      const signUpResult = await signUp({
        username,
        password,
        options: {
          userAttributes: {
            name,
            'custom:organization': organization || '',
          },
        },
      });

      // 이메일 인증이 필요한 경우
      if (!signUpResult.isSignUpComplete) {
        setIsLoading(false);
        return { needsConfirmation: true, username };
      }

      // 자동 로그인
      await signIn({ username, password });

      // signIn이 성공하면 토큰이 준비될 때까지 잠시 대기
      await new Promise(resolve => setTimeout(resolve, 500));

      // Cognito userId 가져오기
      const currentUser = await getCurrentUser();

      // DynamoDB에 사용자 프로필 생성
      const userProfile = await UserService.createUserProfile(
        currentUser.userId,
        username,
        name,
        organization
      );

      setUser(userProfile);
      return { needsConfirmation: false };
    } catch (error) {
      logger.error('Signup error:', error);
      throw new Error(error instanceof Error ? error.message : '회원가입 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  const confirmSignup = async (username: string, code: string) => {
    setIsLoading(true);
    try {
      // 인증 코드 확인
      await confirmSignUp({ username, confirmationCode: code });
    } catch (error) {
      logger.error('Confirmation error:', error);
      throw new Error(
        error instanceof Error ? error.message : '인증 코드 확인 중 오류가 발생했습니다.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      await signOut();
      setUser(null);
      stopSessionCheck();
    } catch (error) {
      logger.error('Logout error:', error);
    }
  };

  useEffect(() => {
    fetchCurrentUser().finally(() => setIsLoading(false));

    // 컴포넌트 언마운트 시 인터벌 정리
    return () => {
      stopSessionCheck();
    };
  }, []);

  return (
    <AuthContext.Provider value={{ user, login, signup, confirmSignup, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
