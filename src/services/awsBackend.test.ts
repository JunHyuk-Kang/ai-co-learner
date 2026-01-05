import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UserService } from './awsBackend';
import * as apiUtils from './apiUtils';

// Mock apiUtils
vi.mock('./apiUtils', () => ({
  apiGet: vi.fn(),
  apiPost: vi.fn(),
}));

describe('UserService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getUserProfile', () => {
    it('should return user profile with converted userId to id', async () => {
      const mockUserData = {
        userId: 'user-123',
        username: 'testuser',
        name: 'Test User',
        role: 'USER',
        level: 1,
      };

      vi.mocked(apiUtils.apiGet).mockResolvedValue(mockUserData);

      const result = await UserService.getUserProfile('user-123');

      expect(apiUtils.apiGet).toHaveBeenCalledWith('/users/user-123');
      expect(result).toEqual({
        ...mockUserData,
        id: 'user-123',
      });
    });

    it('should return null on error', async () => {
      vi.mocked(apiUtils.apiGet).mockRejectedValue(new Error('API Error'));

      const result = await UserService.getUserProfile('user-123');

      expect(result).toBeNull();
    });

    it('should handle user data without userId field', async () => {
      const mockUserData = {
        id: 'user-123',
        username: 'testuser',
        name: 'Test User',
      };

      vi.mocked(apiUtils.apiGet).mockResolvedValue(mockUserData);

      const result = await UserService.getUserProfile('user-123');

      expect(result).toEqual(mockUserData);
    });
  });

  describe('createUserProfile', () => {
    it('should create user profile with default values', async () => {
      const mockResponse = {
        userId: 'user-123',
        username: 'testuser',
        name: 'Test User',
        organization: '',
        role: 'USER',
        level: 1,
        title: '초보 탐험가',
      };

      vi.mocked(apiUtils.apiPost).mockResolvedValue(mockResponse);

      const result = await UserService.createUserProfile('user-123', 'testuser', 'Test User');

      expect(apiUtils.apiPost).toHaveBeenCalledWith('/users', {
        userId: 'user-123',
        username: 'testuser',
        name: 'Test User',
        organization: '',
        role: 'USER',
        level: 1,
        title: '초보 탐험가',
      });

      expect(result).toEqual({
        ...mockResponse,
        id: 'user-123',
      });
    });

    it('should create user profile with organization', async () => {
      const mockResponse = {
        userId: 'user-123',
        username: 'testuser',
        name: 'Test User',
        organization: 'Test Org',
        role: 'USER',
        level: 1,
        title: '초보 탐험가',
      };

      vi.mocked(apiUtils.apiPost).mockResolvedValue(mockResponse);

      const result = await UserService.createUserProfile(
        'user-123',
        'testuser',
        'Test User',
        'Test Org'
      );

      expect(apiUtils.apiPost).toHaveBeenCalledWith('/users', {
        userId: 'user-123',
        username: 'testuser',
        name: 'Test User',
        organization: 'Test Org',
        role: 'USER',
        level: 1,
        title: '초보 탐험가',
      });

      expect(result.organization).toBe('Test Org');
    });
  });

  describe('getCompetencies', () => {
    it('should return user competencies', async () => {
      const mockCompetencies = {
        userId: 'user-123',
        competencies: [
          {
            name: 'questionQuality',
            score: 75,
            updatedAt: Date.now(),
            totalMessages: 10,
            trend: 5,
          },
          { name: 'thinkingDepth', score: 80, updatedAt: Date.now(), totalMessages: 10, trend: 3 },
        ],
        lastUpdated: Date.now(),
      };

      vi.mocked(apiUtils.apiGet).mockResolvedValue(mockCompetencies);

      const result = await UserService.getCompetencies('user-123');

      expect(apiUtils.apiGet).toHaveBeenCalledWith('/users/user-123/competencies');
      expect(result).toEqual(mockCompetencies);
    });

    it('should return null on error', async () => {
      vi.mocked(apiUtils.apiGet).mockRejectedValue(new Error('API Error'));

      const result = await UserService.getCompetencies('user-123');

      expect(result).toBeNull();
    });
  });
});
