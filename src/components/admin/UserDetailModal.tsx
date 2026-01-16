import React from 'react';
import { X } from 'lucide-react';
import { Button } from '../ui/Button';
import { CompetencyRadar } from '../dashboard/CompetencyRadar';

interface UserDetailModalProps {
  user: {
    userId: string;
    name: string;
    username: string;
    email?: string;
    level: number;
    experiencePoints?: number;
    role: string;
  };
  onClose: () => void;
  usageData?: {
    totalMessages: number;
    totalCost: number;
  };
}

export const UserDetailModal: React.FC<UserDetailModalProps> = ({ user, onClose, usageData }) => {
  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-surface border border-border rounded-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-6">
          <div className="flex items-start justify-between mb-6">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center font-bold text-white text-2xl">
                {user.name.charAt(0)}
              </div>
              <div>
                <h2 className="text-2xl font-bold text-white">{user.name}</h2>
                <p className="text-sm text-gray-400">@{user.username}</p>
                {user.email && <p className="text-xs text-gray-500">{user.email}</p>}
              </div>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
              <X size={24} />
            </button>
          </div>

          {/* User Info */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div>
              <p className="text-xs text-gray-500 mb-1">레벨</p>
              <p className="text-lg font-bold text-white">Lv.{user.level}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">경험치</p>
              <p className="text-lg font-bold text-white">{user.experiencePoints || 0} XP</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-1">역할</p>
              <span
                className={`px-2 py-1 rounded text-xs font-medium ${
                  user.role === 'ADMIN'
                    ? 'bg-purple-500/20 text-purple-300'
                    : user.role === 'SUPER_USER'
                      ? 'bg-blue-500/20 text-blue-300'
                      : 'bg-gray-700 text-gray-300'
                }`}
              >
                {user.role}
              </span>
            </div>
          </div>

          {/* Competency Radar Chart */}
          <div className="mb-6">
            <h3 className="text-lg font-bold text-white mb-4">역량 분석</h3>
            <CompetencyRadar userId={user.userId} />
          </div>

          {/* Activity Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="p-4 bg-[#121212] rounded-lg border border-border">
              <p className="text-xs text-gray-500 mb-1">총 메시지</p>
              <p className="text-2xl font-bold text-white">{usageData?.totalMessages || 0}</p>
            </div>
            <div className="p-3 bg-surface rounded-lg border border-border">
              <p className="text-xs text-gray-400 mb-1">총 비용</p>
              <p className="text-lg font-bold text-white">
                ${(usageData?.totalCost || 0).toFixed(4)}
              </p>
            </div>
            <div className="p-3 bg-surface rounded-lg border border-border">
              <p className="text-xs text-gray-400 mb-1">평균 메시지당</p>
              <p className="text-lg font-bold text-white">
                $
                {usageData && usageData.totalMessages > 0
                  ? (usageData.totalCost / usageData.totalMessages).toFixed(6)
                  : '0.000000'}
              </p>
            </div>
          </div>

          {/* Close button */}
          <div className="flex justify-end mt-6">
            <Button variant="ghost" onClick={onClose}>
              닫기
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
