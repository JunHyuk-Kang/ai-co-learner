import React, { useEffect, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { CompetencyHistoryService, CompetencyHistoryData } from '../../services/awsBackend';

interface CompetencyGrowthChartProps {
  userId: string;
  days?: number;
}

const COMPETENCY_COLORS: Record<string, string> = {
  questionQuality: '#8b5cf6',
  thinkingDepth: '#3b82f6',
  creativity: '#f59e0b',
  communicationClarity: '#10b981',
  executionOriented: '#ef4444',
  collaborationSignal: '#ec4899',
};

const COMPETENCY_LABELS: Record<string, string> = {
  questionQuality: '질문력',
  thinkingDepth: '사고력',
  creativity: '창의력',
  communicationClarity: '소통력',
  executionOriented: '실행력',
  collaborationSignal: '협업력',
};

export const CompetencyGrowthChart: React.FC<CompetencyGrowthChartProps> = ({ userId, days = 30 }) => {
  const [historyData, setHistoryData] = useState<CompetencyHistoryData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadHistory();
  }, [userId, days]);

  const loadHistory = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await CompetencyHistoryService.getHistory(userId, days);

      if (data && data.history) {
        setHistoryData(data.history);
      } else {
        setHistoryData([]);
      }
    } catch (err) {
      console.error('Failed to load competency history:', err);
      setError('역량 성장 데이터를 불러오는데 실패했습니다.');
      setHistoryData([]);
    } finally {
      setLoading(false);
    }
  };

  // 차트용 데이터 포맷팅
  const chartData = historyData.map(day => ({
    date: new Date(day.date).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' }),
    ...day.competencies
  }));

  // 데이터에 있는 역량만 추출
  const availableCompetencies = historyData.length > 0
    ? Object.keys(historyData[0].competencies)
    : [];

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center text-red-400 py-8">{error}</div>
    );
  }

  if (historyData.length === 0) {
    return (
      <div>
        <h2 className="text-xl font-bold text-gray-200 mb-4">역량 성장 추이</h2>
        <div className="text-center text-gray-400 py-12">
          <p className="mb-2">아직 충분한 데이터가 없습니다</p>
          <p className="text-sm">AI 봇과 대화하면서 데이터가 쌓이면 여기에 성장 그래프가 표시됩니다</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-bold text-gray-200 mb-1">역량 성장 추이</h2>
        <p className="text-sm text-gray-400">최근 {days}일간의 역량 변화</p>
      </div>

      <ResponsiveContainer width="100%" height={400}>
        <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#333" />
          <XAxis
            dataKey="date"
            stroke="#9ca3af"
            style={{ fontSize: '12px' }}
          />
          <YAxis
            stroke="#9ca3af"
            style={{ fontSize: '12px' }}
            domain={[0, 100]}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#1E1E1E',
              border: '1px solid #333',
              borderRadius: '8px',
              boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.5)'
            }}
            labelStyle={{ color: '#e5e7eb', fontWeight: 'bold' }}
          />
          <Legend
            wrapperStyle={{ paddingTop: '20px' }}
            formatter={(value) => COMPETENCY_LABELS[value] || value}
          />

          {availableCompetencies.map(competency => (
            <Line
              key={competency}
              type="monotone"
              dataKey={competency}
              stroke={COMPETENCY_COLORS[competency] || '#6b7280'}
              strokeWidth={2}
              dot={{ r: 4 }}
              activeDot={{ r: 6 }}
              name={competency}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>

      {/* 통계 요약 */}
      <div className="mt-6 grid grid-cols-2 md:grid-cols-3 gap-4">
        {availableCompetencies.map(competency => {
          const values = historyData.map(d => d.competencies[competency] || 0);
          const latest = values[values.length - 1] || 0;
          const earliest = values[0] || 0;
          const change = latest - earliest;

          return (
            <div key={competency} className="bg-[#2A2A2A] rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: COMPETENCY_COLORS[competency] }}
                />
                <p className="text-xs font-medium text-gray-300">
                  {COMPETENCY_LABELS[competency]}
                </p>
              </div>
              <div className="flex items-baseline gap-2">
                <p className="text-lg font-bold text-gray-100">{latest}</p>
                <p className={`text-xs font-semibold ${change >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {change >= 0 ? '+' : ''}{change}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
