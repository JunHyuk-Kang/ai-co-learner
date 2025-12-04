import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { AssessmentService, AssessmentQuestion, AssessmentResult } from '../services/awsBackend';
import { Button } from '../components/ui/Button';
import { Brain, Sparkles, CheckCircle, ArrowRight } from 'lucide-react';

export const InitialAssessment: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [assessmentId, setAssessmentId] = useState<string | null>(null);
  const [currentQuestion, setCurrentQuestion] = useState<AssessmentQuestion | null>(null);
  const [answer, setAnswer] = useState('');
  const [progress, setProgress] = useState({ current: 0, total: 8 });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [isCompleted, setIsCompleted] = useState(false);
  const [results, setResults] = useState<AssessmentResult | null>(null);
  const [hasStarted, setHasStarted] = useState(false);

  const startAssessment = async () => {
    if (!user) return;

    try {
      const data = await AssessmentService.startAssessment(user.id);
      setAssessmentId(data.assessmentId);
      setCurrentQuestion(data.firstQuestion);
      setProgress({ current: 0, total: data.totalQuestions });
      setHasStarted(true);
    } catch (error) {
      console.error('Failed to start assessment:', error);
      alert('진단을 시작하는데 실패했습니다.');
    }
  };

  const submitAnswer = async () => {
    if (!user || !assessmentId || !currentQuestion || !answer.trim()) {
      return;
    }

    setIsSubmitting(true);

    try {
      const result = await AssessmentService.submitAnswer(
        user.id,
        assessmentId,
        currentQuestion.id,
        answer
      );

      setAnalysis(result.analysis);
      setProgress(result.progress);

      // 잠시 분석 결과를 보여준 후 다음 질문으로
      setTimeout(() => {
        if (result.isCompleted) {
          setIsCompleted(true);
          setResults(result.results);
        } else {
          setCurrentQuestion(result.nextQuestion);
          setAnswer('');
          setAnalysis(null);
        }
        setIsSubmitting(false);
      }, 2000);
    } catch (error) {
      console.error('Failed to submit answer:', error);
      alert('답변 제출에 실패했습니다.');
      setIsSubmitting(false);
    }
  };

  const goToDashboard = () => {
    navigate('/dashboard');
  };

  if (!user) return null;

  // 완료 화면
  if (isCompleted && results) {
    return (
      <div className="flex-1 overflow-y-auto bg-[#121212] text-white p-8">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-12">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-green-500/20 rounded-full mb-6">
              <CheckCircle className="text-green-400" size={48} />
            </div>
            <h1 className="text-3xl font-bold mb-4">역량 진단 완료!</h1>
            <p className="text-gray-400">
              당신의 학습 역량을 분석했습니다. 이제 맞춤형 학습 파트너와 함께 성장해보세요!
            </p>
          </div>

          <div className="bg-[#1E1E1E] border border-[#333] rounded-xl p-8 mb-8">
            <h2 className="text-xl font-bold mb-6">당신의 역량 프로필</h2>

            <div className="space-y-4">
              {Object.entries(results).map(([key, value]) => {
                const competencyNames: Record<string, string> = {
                  questionQuality: '질문의 질',
                  thinkingDepth: '사고의 깊이',
                  creativity: '창의성',
                  communicationClarity: '소통 명확성',
                  executionOriented: '실행 지향성',
                  collaborationSignal: '협업 능력'
                };

                const percentage = (value / 10) * 100;

                return (
                  <div key={key}>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-medium text-gray-300">
                        {competencyNames[key]}
                      </span>
                      <span className="text-sm font-bold text-primary">
                        {value.toFixed(1)} / 10
                      </span>
                    </div>
                    <div className="h-2 bg-[#2A2A2A] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-primary to-purple-500 rounded-full transition-all duration-500"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="text-center">
            <Button onClick={goToDashboard} className="gap-2">
              학습 시작하기
              <ArrowRight size={16} />
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // 진단 시작 전 화면
  if (!hasStarted) {
    return (
      <div className="flex-1 overflow-y-auto bg-[#121212] text-white p-8">
        <div className="max-w-2xl mx-auto py-12">
          <div className="text-center mb-12">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-primary/20 rounded-full mb-6">
              <Brain className="text-primary" size={48} />
            </div>
            <h1 className="text-3xl font-bold mb-4">초기 역량 진단</h1>
            <p className="text-gray-400 text-lg">
              8개의 질문을 통해 당신의 학습 역량을 분석합니다.
              <br />
              솔직하게 답변해주시면 더 정확한 맞춤형 학습 경로를 제공해드릴 수 있습니다.
            </p>
          </div>

          <div className="bg-[#1E1E1E] border border-[#333] rounded-xl p-8 mb-8">
            <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
              <Sparkles className="text-yellow-400" size={20} />
              진단 항목
            </h3>

            <div className="grid grid-cols-2 gap-4">
              {[
                { name: '질문의 질', icon: '🎯' },
                { name: '사고의 깊이', icon: '🧠' },
                { name: '창의성', icon: '💡' },
                { name: '소통 명확성', icon: '💬' },
                { name: '실행 지향성', icon: '🚀' },
                { name: '협업 능력', icon: '🤝' },
              ].map((item) => (
                <div
                  key={item.name}
                  className="flex items-center gap-3 bg-[#252525] rounded-lg p-3"
                >
                  <span className="text-2xl">{item.icon}</span>
                  <span className="text-sm font-medium text-gray-300">{item.name}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="text-center">
            <Button onClick={startAssessment} className="gap-2" size="lg">
              진단 시작하기
              <ArrowRight size={16} />
            </Button>
            <p className="text-xs text-gray-500 mt-4">소요 시간: 약 5-10분</p>
          </div>
        </div>
      </div>
    );
  }

  // 질문 진행 화면
  return (
    <div className="flex-1 overflow-y-auto bg-[#121212] text-white p-8">
      <div className="max-w-3xl mx-auto">
        {/* Progress Bar */}
        <div className="mb-8">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium text-gray-400">
              질문 {progress.current + 1} / {progress.total}
            </span>
            <span className="text-sm font-medium text-primary">
              {Math.round(((progress.current + 1) / progress.total) * 100)}%
            </span>
          </div>
          <div className="h-2 bg-[#2A2A2A] rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-300"
              style={{ width: `${((progress.current + 1) / progress.total) * 100}%` }}
            />
          </div>
        </div>

        {/* Question Card */}
        <div className="bg-[#1E1E1E] border border-[#333] rounded-xl p-8 mb-6">
          <h2 className="text-xl font-bold mb-6">{currentQuestion?.question}</h2>

          <textarea
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            placeholder="자유롭게 답변해주세요. 구체적일수록 더 정확한 분석이 가능합니다."
            className="w-full bg-[#252525] border border-[#333] rounded-lg p-4 text-white placeholder-gray-500 focus:outline-none focus:border-primary min-h-[200px] resize-none"
            disabled={isSubmitting}
          />

          {analysis && (
            <div className="mt-6 p-4 bg-primary/10 border border-primary/20 rounded-lg">
              <p className="text-sm text-primary font-medium mb-1">AI 분석</p>
              <p className="text-sm text-gray-300">{analysis}</p>
            </div>
          )}
        </div>

        {/* Submit Button */}
        <div className="flex justify-end">
          <Button
            onClick={submitAnswer}
            disabled={!answer.trim() || isSubmitting}
            className="gap-2"
          >
            {isSubmitting ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                분석 중...
              </>
            ) : (
              <>
                다음
                <ArrowRight size={16} />
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};
