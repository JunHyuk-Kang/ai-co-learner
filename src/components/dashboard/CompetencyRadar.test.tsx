import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { CompetencyRadar } from './CompetencyRadar';
import { UserService } from '../../services/awsBackend';

// Mock UserService
vi.mock('../../services/awsBackend', () => ({
  UserService: {
    getCompetencies: vi.fn(),
  },
}));

// Mock Recharts components to avoid rendering issues in tests
vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: any) => (
    <div data-testid="responsive-container">{children}</div>
  ),
  RadarChart: ({ children }: any) => <div data-testid="radar-chart">{children}</div>,
  Radar: () => <div data-testid="radar" />,
  PolarGrid: () => <div data-testid="polar-grid" />,
  PolarAngleAxis: () => <div data-testid="polar-angle-axis" />,
}));

describe('CompetencyRadar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render loading state initially', () => {
    vi.mocked(UserService.getCompetencies).mockImplementation(
      () => new Promise(() => {}) // Never resolves
    );

    render(<CompetencyRadar userId="user-123" />);

    // Component should be in loading state
    expect(UserService.getCompetencies).toHaveBeenCalledWith('user-123');
  });

  it('should render competency data when available', async () => {
    const mockCompetencies = {
      userId: 'user-123',
      competencies: [
        { name: 'questionQuality', score: 75, updatedAt: Date.now(), totalMessages: 10, trend: 5 },
        { name: 'thinkingDepth', score: 80, updatedAt: Date.now(), totalMessages: 10, trend: 3 },
        { name: 'creativity', score: 70, updatedAt: Date.now(), totalMessages: 10, trend: 2 },
        {
          name: 'communicationClarity',
          score: 85,
          updatedAt: Date.now(),
          totalMessages: 10,
          trend: 4,
        },
        {
          name: 'executionOriented',
          score: 65,
          updatedAt: Date.now(),
          totalMessages: 10,
          trend: 1,
        },
        {
          name: 'collaborationSignal',
          score: 72,
          updatedAt: Date.now(),
          totalMessages: 10,
          trend: 3,
        },
      ],
      lastUpdated: Date.now(),
    };

    vi.mocked(UserService.getCompetencies).mockResolvedValue(mockCompetencies);

    render(<CompetencyRadar userId="user-123" />);

    await waitFor(() => {
      expect(screen.getByTestId('radar-chart')).toBeInTheDocument();
    });

    expect(UserService.getCompetencies).toHaveBeenCalledWith('user-123');
  });

  it('should render default data when no competencies available', async () => {
    vi.mocked(UserService.getCompetencies).mockResolvedValue(null);

    render(<CompetencyRadar userId="user-123" />);

    await waitFor(() => {
      expect(screen.getByTestId('radar-chart')).toBeInTheDocument();
    });
  });

  it('should render default data when competencies array is empty', async () => {
    const mockEmptyCompetencies = {
      userId: 'user-123',
      competencies: [],
      lastUpdated: Date.now(),
    };

    vi.mocked(UserService.getCompetencies).mockResolvedValue(mockEmptyCompetencies);

    render(<CompetencyRadar userId="user-123" />);

    await waitFor(() => {
      expect(screen.getByTestId('radar-chart')).toBeInTheDocument();
    });
  });

  it('should reload competencies when userId changes', async () => {
    const mockCompetencies1 = {
      userId: 'user-123',
      competencies: [
        { name: 'questionQuality', score: 75, updatedAt: Date.now(), totalMessages: 10, trend: 5 },
      ],
      lastUpdated: Date.now(),
    };

    const mockCompetencies2 = {
      userId: 'user-456',
      competencies: [
        { name: 'questionQuality', score: 85, updatedAt: Date.now(), totalMessages: 20, trend: 8 },
      ],
      lastUpdated: Date.now(),
    };

    vi.mocked(UserService.getCompetencies)
      .mockResolvedValueOnce(mockCompetencies1)
      .mockResolvedValueOnce(mockCompetencies2);

    const { rerender } = render(<CompetencyRadar userId="user-123" />);

    await waitFor(() => {
      expect(UserService.getCompetencies).toHaveBeenCalledWith('user-123');
    });

    rerender(<CompetencyRadar userId="user-456" />);

    await waitFor(() => {
      expect(UserService.getCompetencies).toHaveBeenCalledWith('user-456');
    });

    expect(UserService.getCompetencies).toHaveBeenCalledTimes(2);
  });
});
