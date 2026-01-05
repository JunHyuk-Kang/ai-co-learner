import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import {
  User as UserIcon,
  Mail,
  Shield,
  Award,
  Edit2,
  Save,
  X,
  Lock,
  Eye,
  EyeOff,
  Building2,
} from 'lucide-react';
import { UserService } from '../services/awsBackend';
import { updatePassword } from 'aws-amplify/auth';
import { logger } from '../utils/logger';

export const UserProfile: React.FC = () => {
  const { user, logout } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [editedName, setEditedName] = useState(user?.name || '');
  const [editedOrganization, setEditedOrganization] = useState(user?.organization || '');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Password change states
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showOldPassword, setShowOldPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  useEffect(() => {
    if (user) {
      setEditedName(user.name);
      setEditedOrganization(user.organization || '');
    }
  }, [user]);

  const handleSave = async () => {
    if (!user) return;

    if (editedName.trim().length < 2) {
      setError('이름은 최소 2자 이상이어야 합니다.');
      return;
    }

    setIsSaving(true);
    setError(null);
    setSuccessMessage(null);

    try {
      await UserService.updateUserProfile(user.id, editedName.trim(), editedOrganization.trim());
      setSuccessMessage('프로필이 성공적으로 업데이트되었습니다.');
      setIsEditing(false);

      // 성공 메시지 3초 후 자동 제거 및 페이지 새로고침
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } catch (err) {
      setError('프로필 업데이트 중 오류가 발생했습니다.');
      logger.error('Profile update error:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setEditedName(user?.name || '');
    setEditedOrganization(user?.organization || '');
    setIsEditing(false);
    setError(null);
  };

  const handlePasswordChange = async () => {
    setError(null);
    setSuccessMessage(null);

    // Validation
    if (!oldPassword || !newPassword || !confirmPassword) {
      setError('모든 비밀번호 필드를 입력해주세요.');
      return;
    }

    if (newPassword.length < 8) {
      setError('새 비밀번호는 최소 8자 이상이어야 합니다.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('새 비밀번호가 일치하지 않습니다.');
      return;
    }

    setIsSaving(true);

    try {
      await updatePassword({ oldPassword, newPassword });
      setSuccessMessage('비밀번호가 성공적으로 변경되었습니다.');

      // Reset password fields
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setIsChangingPassword(false);

      // Auto hide success message
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: any) {
      logger.error('Password change error:', err);

      if (err.name === 'NotAuthorizedException') {
        setError('현재 비밀번호가 올바르지 않습니다.');
      } else if (err.name === 'InvalidPasswordException') {
        setError(
          '새 비밀번호가 요구사항을 충족하지 않습니다. 최소 8자, 대소문자, 숫자, 특수문자를 포함해야 합니다.'
        );
      } else if (err.name === 'LimitExceededException') {
        setError('비밀번호 변경 시도 횟수를 초과했습니다. 잠시 후 다시 시도해주세요.');
      } else {
        setError('비밀번호 변경 중 오류가 발생했습니다.');
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancelPasswordChange = () => {
    setOldPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setIsChangingPassword(false);
    setError(null);
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-400">사용자 정보를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-4xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gray-800 rounded-lg shadow-xl overflow-hidden"
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-8 text-white">
            <div className="flex items-center space-x-4">
              <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm">
                <UserIcon className="w-12 h-12" />
              </div>
              <div>
                <h1 className="text-3xl font-bold">{user.name}</h1>
                <p className="text-blue-100 mt-1">@{user.username}</p>
              </div>
            </div>
          </div>

          {/* Profile Information */}
          <div className="p-8">
            {/* Success Message */}
            {successMessage && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-6 p-4 bg-green-500/20 border border-green-500/50 rounded-lg text-green-400"
              >
                {successMessage}
              </motion.div>
            )}

            {/* Error Message */}
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-6 p-4 bg-red-500/20 border border-red-500/50 rounded-lg text-red-400"
              >
                {error}
              </motion.div>
            )}

            <div className="space-y-6">
              {/* Name */}
              <div className="flex items-center justify-between p-4 bg-gray-700/50 rounded-lg">
                <div className="flex items-center space-x-3 flex-1">
                  <UserIcon className="w-5 h-5 text-blue-400" />
                  <div className="flex-1">
                    <p className="text-sm text-gray-400 mb-1">이름</p>
                    {isEditing ? (
                      <input
                        type="text"
                        value={editedName}
                        onChange={e => setEditedName(e.target.value)}
                        className="w-full bg-gray-600 text-white px-3 py-2 rounded border border-gray-500 focus:border-blue-500 focus:outline-none"
                        placeholder="이름을 입력하세요"
                      />
                    ) : (
                      <p className="text-white font-medium">{user.name}</p>
                    )}
                  </div>
                </div>
                {!isEditing && (
                  <button
                    onClick={() => setIsEditing(true)}
                    className="ml-4 p-2 text-blue-400 hover:text-blue-300 transition-colors"
                    title="수정"
                  >
                    <Edit2 className="w-5 h-5" />
                  </button>
                )}
              </div>

              {/* Organization */}
              <div className="flex items-center space-x-3 p-4 bg-gray-700/50 rounded-lg">
                <Building2 className="w-5 h-5 text-indigo-400" />
                <div className="flex-1">
                  <p className="text-sm text-gray-400 mb-1">소속</p>
                  {isEditing ? (
                    <input
                      type="text"
                      value={editedOrganization}
                      onChange={e => setEditedOrganization(e.target.value)}
                      className="w-full bg-gray-600 text-white px-3 py-2 rounded border border-gray-500 focus:border-blue-500 focus:outline-none"
                      placeholder="소속을 입력하세요 (예: ABC 회사, XYZ 대학교)"
                    />
                  ) : (
                    <p className="text-white font-medium">{user.organization || '미설정'}</p>
                  )}
                </div>
              </div>

              {/* Edit Actions */}
              {isEditing && (
                <div className="flex space-x-3">
                  <button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="flex-1 flex items-center justify-center space-x-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white px-4 py-3 rounded-lg transition-colors"
                  >
                    <Save className="w-5 h-5" />
                    <span>{isSaving ? '저장 중...' : '저장'}</span>
                  </button>
                  <button
                    onClick={handleCancel}
                    disabled={isSaving}
                    className="flex-1 flex items-center justify-center space-x-2 bg-gray-600 hover:bg-gray-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white px-4 py-3 rounded-lg transition-colors"
                  >
                    <X className="w-5 h-5" />
                    <span>취소</span>
                  </button>
                </div>
              )}

              {/* Username (Read-only) */}
              <div className="flex items-center space-x-3 p-4 bg-gray-700/50 rounded-lg">
                <Mail className="w-5 h-5 text-purple-400" />
                <div>
                  <p className="text-sm text-gray-400 mb-1">사용자명</p>
                  <p className="text-white font-medium">{user.username}</p>
                </div>
              </div>

              {/* Role */}
              <div className="flex items-center space-x-3 p-4 bg-gray-700/50 rounded-lg">
                <Shield className="w-5 h-5 text-green-400" />
                <div>
                  <p className="text-sm text-gray-400 mb-1">역할</p>
                  <p className="text-white font-medium">
                    {user.role === 'ADMIN' ? '관리자' : '일반 사용자'}
                  </p>
                </div>
              </div>

              {/* Level & Title */}
              <div className="flex items-center space-x-3 p-4 bg-gray-700/50 rounded-lg">
                <Award className="w-5 h-5 text-yellow-400" />
                <div>
                  <p className="text-sm text-gray-400 mb-1">레벨 & 칭호</p>
                  <p className="text-white font-medium">
                    Lv.{user.level} {user.title || '탐험가'}
                  </p>
                </div>
              </div>

              {/* Password Change Section */}
              <div className="p-4 bg-gray-700/50 rounded-lg border border-gray-600">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-3">
                    <Lock className="w-5 h-5 text-orange-400" />
                    <p className="text-sm font-medium text-white">비밀번호</p>
                  </div>
                  {!isChangingPassword && (
                    <button
                      onClick={() => setIsChangingPassword(true)}
                      className="text-sm text-blue-400 hover:text-blue-300 transition-colors"
                    >
                      변경
                    </button>
                  )}
                </div>

                {isChangingPassword ? (
                  <div className="space-y-3 mt-4">
                    {/* Old Password */}
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">현재 비밀번호</label>
                      <div className="relative">
                        <input
                          type={showOldPassword ? 'text' : 'password'}
                          value={oldPassword}
                          onChange={e => setOldPassword(e.target.value)}
                          className="w-full bg-gray-600 text-white px-3 py-2 pr-10 rounded border border-gray-500 focus:border-blue-500 focus:outline-none"
                          placeholder="현재 비밀번호"
                        />
                        <button
                          type="button"
                          onClick={() => setShowOldPassword(!showOldPassword)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-300"
                        >
                          {showOldPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                      </div>
                    </div>

                    {/* New Password */}
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">새 비밀번호</label>
                      <div className="relative">
                        <input
                          type={showNewPassword ? 'text' : 'password'}
                          value={newPassword}
                          onChange={e => setNewPassword(e.target.value)}
                          className="w-full bg-gray-600 text-white px-3 py-2 pr-10 rounded border border-gray-500 focus:border-blue-500 focus:outline-none"
                          placeholder="최소 8자 이상"
                        />
                        <button
                          type="button"
                          onClick={() => setShowNewPassword(!showNewPassword)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-300"
                        >
                          {showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                      </div>
                    </div>

                    {/* Confirm Password */}
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">비밀번호 확인</label>
                      <div className="relative">
                        <input
                          type={showConfirmPassword ? 'text' : 'password'}
                          value={confirmPassword}
                          onChange={e => setConfirmPassword(e.target.value)}
                          className="w-full bg-gray-600 text-white px-3 py-2 pr-10 rounded border border-gray-500 focus:border-blue-500 focus:outline-none"
                          placeholder="새 비밀번호 확인"
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-300"
                        >
                          {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                      </div>
                    </div>

                    {/* Password Change Actions */}
                    <div className="flex space-x-2 pt-2">
                      <button
                        onClick={handlePasswordChange}
                        disabled={isSaving}
                        className="flex-1 flex items-center justify-center space-x-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white px-3 py-2 rounded-lg text-sm transition-colors"
                      >
                        <Save className="w-4 h-4" />
                        <span>{isSaving ? '변경 중...' : '변경'}</span>
                      </button>
                      <button
                        onClick={handleCancelPasswordChange}
                        disabled={isSaving}
                        className="flex-1 flex items-center justify-center space-x-2 bg-gray-600 hover:bg-gray-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white px-3 py-2 rounded-lg text-sm transition-colors"
                      >
                        <X className="w-4 h-4" />
                        <span>취소</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-gray-400">••••••••</p>
                )}
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="p-6 bg-gray-700/30 border-t border-gray-700">
            <div className="flex space-x-4">
              <button
                onClick={() => window.history.back()}
                className="flex-1 bg-gray-600 hover:bg-gray-700 text-white px-4 py-3 rounded-lg transition-colors"
              >
                돌아가기
              </button>
              <button
                onClick={logout}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white px-4 py-3 rounded-lg transition-colors"
              >
                로그아웃
              </button>
            </div>
          </div>
        </motion.div>

        {/* Additional Info */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="mt-6 text-center text-sm text-gray-500"
        >
          <p>계정 정보는 안전하게 암호화되어 관리됩니다.</p>
        </motion.div>
      </div>
    </div>
  );
};

export default UserProfile;
