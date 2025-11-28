import React, { createContext, useContext, useState, useEffect } from 'react';
import { signUp, signIn, signOut, getCurrentUser, confirmSignUp, fetchUserAttributes } from 'aws-amplify/auth';
import { User } from '../types';
import { UserService } from '../services/awsBackend';

interface AuthContextType {
  user: User | null;
  login: (username: string, password: string) => Promise<void>;
  signup: (username: string, password: string, name: string) => Promise<{ needsConfirmation: boolean; username?: string }>;
  confirmSignup: (username: string, code: string) => Promise<void>;
  logout: () => Promise<void>;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchCurrentUser = async () => {
    try {
      const currentUser = await getCurrentUser();

      // DynamoDB에서 사용자 프로필 가져오기
      const userProfile = await UserService.getUserProfile(currentUser.userId);

      if (userProfile) {
        // 프로필이 있지만 name이 userId처럼 보이면 수정
        const userAttributes = await fetchUserAttributes();

        const cognitoName = userAttributes.name || currentUser.username;

        // name이 UUID 형태(userId)이고 Cognito에 실제 이름이 있으면 업데이트
        if (userProfile.name === currentUser.userId && cognitoName !== currentUser.userId) {
          const updatedProfile = await UserService.updateUserProfile(currentUser.userId, cognitoName);
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
    } catch (error) {
      console.error('Error fetching user:', error);
      setUser(null);
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
    } catch (error: any) {
      console.error('Login error:', error);
      throw new Error(error.message || '로그인 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  const signup = async (username: string, password: string, name: string) => {
    setIsLoading(true);
    try {
      // Cognito에 회원가입
      const signUpResult = await signUp({
        username,
        password,
        options: {
          userAttributes: {
            name,
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
        name
      );

      setUser(userProfile);
      return { needsConfirmation: false };

    } catch (error: any) {
      console.error('Signup error:', error);
      throw new Error(error.message || '회원가입 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  const confirmSignup = async (username: string, code: string) => {
    setIsLoading(true);
    try {
      // 인증 코드 확인
      await confirmSignUp({ username, confirmationCode: code });

    } catch (error: any) {
      console.error('Confirmation error:', error);
      throw new Error(error.message || '인증 코드 확인 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      await signOut();
      setUser(null);
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  useEffect(() => {
    fetchCurrentUser().finally(() => setIsLoading(false));
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