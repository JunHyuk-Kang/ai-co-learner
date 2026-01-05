import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { AuthProvider, useAuth } from './AuthContext';
import * as amplifyAuth from 'aws-amplify/auth';
import { UserService } from '../services/awsBackend';

// Mock UserService
vi.mock('../services/awsBackend', () => ({
  UserService: {
    getUserProfile: vi.fn(),
    createUserProfile: vi.fn(),
  },
}));

// Test component to access AuthContext
const TestComponent = () => {
  const { user, isLoading } = useAuth();
  return (
    <div>
      <div data-testid="loading">{isLoading ? 'Loading' : 'Not Loading'}</div>
      <div data-testid="user">{user ? user.username : 'No User'}</div>
    </div>
  );
};

describe('AuthContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should provide initial loading state', () => {
    vi.mocked(amplifyAuth.getCurrentUser).mockResolvedValue({
      userId: 'user-123',
      username: 'testuser',
    } as any);

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    expect(screen.getByTestId('loading')).toHaveTextContent('Loading');
  });

  it('should set user after successful authentication check', async () => {
    const mockUser = {
      id: 'user-123',
      userId: 'user-123',
      username: 'testuser',
      name: 'Test User',
      role: 'USER',
      level: 1,
    };

    vi.mocked(amplifyAuth.getCurrentUser).mockResolvedValue({
      userId: 'user-123',
      username: 'testuser',
    } as any);

    vi.mocked(amplifyAuth.fetchAuthSession).mockResolvedValue({
      tokens: {
        accessToken: {
          payload: {
            exp: Math.floor(Date.now() / 1000) + 3600,
          },
          toString: () => 'mock-token',
        },
      },
    } as any);

    vi.mocked(UserService.getUserProfile).mockResolvedValue(mockUser as any);

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('Not Loading');
    });

    await waitFor(() => {
      expect(screen.getByTestId('user')).toHaveTextContent('testuser');
    });
  });

  it('should handle no user case', async () => {
    vi.mocked(amplifyAuth.getCurrentUser).mockRejectedValue(new Error('No user'));

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('Not Loading');
    });

    expect(screen.getByTestId('user')).toHaveTextContent('No User');
  });

  it('should throw error when useAuth is used outside AuthProvider', () => {
    // Suppress console.error for this test
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => {
      render(<TestComponent />);
    }).toThrow('useAuth must be used within an AuthProvider');

    consoleSpy.mockRestore();
  });
});
