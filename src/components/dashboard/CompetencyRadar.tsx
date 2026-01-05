import React, { useEffect, useState } from 'react';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, ResponsiveContainer } from 'recharts';
import { CompetencyData } from '../../types';
import { UserService } from '../../services/awsBackend';
import { logger } from '../../utils/logger';

interface CompetencyRadarProps {
  userId: string;
}

const COMPETENCY_MAP: Record<string, string> = {
  questionQuality: '질문력',
  thinkingDepth: '사고력',
  creativity: '창의력',
  communicationClarity: '소통력',
  executionOriented: '실행력',
  collaborationSignal: '협업력',
};

export const CompetencyRadar: React.FC<CompetencyRadarProps> = ({ userId }) => {
  const [data, setData] = useState<CompetencyData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCompetencies();
  }, [userId]);

  const loadCompetencies = async () => {
    try {
      const result = await UserService.getCompetencies(userId);

      if (result && result.competencies && result.competencies.length > 0) {
        const chartData = result.competencies.map(c => ({
          subject: COMPETENCY_MAP[c.name] || c.name,
          A: c.score,
          fullMark: 100,
        }));
        setData(chartData);
      } else {
        // 데이터가 없으면 기본값 표시
        setData([
          { subject: '질문력', A: 0, fullMark: 100 },
          { subject: '사고력', A: 0, fullMark: 100 },
          { subject: '창의력', A: 0, fullMark: 100 },
          { subject: '소통력', A: 0, fullMark: 100 },
          { subject: '실행력', A: 0, fullMark: 100 },
          { subject: '협업력', A: 0, fullMark: 100 },
        ]);
      }
    } catch (error) {
      logger.error('Failed to load competencies:', error);
      // 에러 시 기본값
      setData([
        { subject: '질문력', A: 0, fullMark: 100 },
        { subject: '사고력', A: 0, fullMark: 100 },
        { subject: '창의력', A: 0, fullMark: 100 },
        { subject: '소통력', A: 0, fullMark: 100 },
        { subject: '실행력', A: 0, fullMark: 100 },
        { subject: '협업력', A: 0, fullMark: 100 },
      ]);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div
        className="h-[250px] w-full flex items-center justify-center"
        style={{ minHeight: '250px' }}
      >
        <div className="text-gray-400">역량 데이터를 불러오는 중...</div>
      </div>
    );
  }

  return (
    <div className="h-[250px] w-full" style={{ minHeight: '250px' }}>
      <ResponsiveContainer width="100%" height="100%" minHeight={250}>
        <RadarChart cx="50%" cy="50%" outerRadius="70%" data={data}>
          <PolarGrid stroke="#333" />
          <PolarAngleAxis dataKey="subject" tick={{ fill: '#9CA3AF', fontSize: 11 }} />
          <Radar
            name="역량"
            dataKey="A"
            stroke="#FF6B00"
            strokeWidth={2}
            fill="#FF6B00"
            fillOpacity={0.2}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
};
