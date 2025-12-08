import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useBots } from '../../contexts/BotContext';
import { Role, UserBot } from '../../types';
import { LayoutDashboard, MessageSquare, LogOut, Shield, Menu, X, Target } from 'lucide-react';
import { Button } from '../ui/Button';

interface LayoutProps {
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  const { user, logout } = useAuth();
  const { bots: myBots } = useBots();
  const location = useLocation();
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const isActive = (path: string) => location.pathname === path;

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  if (!user) return <>{children}</>;

  return (
    <div className="flex h-full bg-background text-gray-100 overflow-hidden">
      {/* Mobile Header */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-14 bg-[#0F0F0F] border-b border-border flex items-center justify-between px-4 z-50">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-primary rounded flex items-center justify-center font-bold text-white text-xs">A</div>
          <span className="font-bold text-sm">AI Co-Learner</span>
        </div>
        <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="p-2 hover:bg-surface rounded-lg transition-colors">
          {isMobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {/* Mobile Sidebar Overlay */}
      {isMobileMenuOpen && (
        <div className="md:hidden fixed inset-0 bg-black/50 z-40" onClick={() => setIsMobileMenuOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0 fixed md:relative w-64 border-r border-border bg-[#0F0F0F] flex flex-col shrink-0 z-50 transition-transform duration-300 ${isMobileMenuOpen ? 'h-[calc(100%-3.5rem)] top-14' : 'h-full top-0'} md:h-full md:top-0`}>
        <div className="hidden md:flex p-6 items-center gap-3">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center font-bold text-white">A</div>
          <span className="font-bold text-lg tracking-tight">AI Co-Learner</span>
        </div>

        <nav className="flex-1 px-4 py-4 space-y-1 overflow-y-auto">
          <Link to="/" onClick={() => setIsMobileMenuOpen(false)}>
            <div className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${isActive('/') ? 'bg-primary/10 text-primary' : 'text-gray-400 hover:bg-surface hover:text-gray-200'}`}>
              <LayoutDashboard size={18} />
              대시보드
            </div>
          </Link>

          <Link to="/quests" onClick={() => setIsMobileMenuOpen(false)}>
            <div className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${isActive('/quests') ? 'bg-primary/10 text-primary' : 'text-gray-400 hover:bg-surface hover:text-gray-200'}`}>
              <Target size={18} />
              일일 퀘스트
            </div>
          </Link>

          <div className="pt-4 pb-2">
            <p className="px-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">학습 도구</p>
          </div>

          {myBots.length > 0 ? (
            myBots.map((bot: UserBot & { templateName: string }) => (
              <Link key={bot.id} to={`/chat/${bot.id}`} onClick={() => setIsMobileMenuOpen(false)}>
                <div className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${location.pathname === `/chat/${bot.id}` ? 'bg-primary/10 text-primary' : 'text-gray-400 hover:bg-surface hover:text-gray-200'}`}>
                  <MessageSquare size={18} />
                  {bot.name}
                </div>
              </Link>
            ))
          ) : (
            <div className="px-3 py-2.5 text-xs text-gray-500">
              생성된 봇이 없습니다
            </div>
          )}

          {user.role === Role.ADMIN && (
            <>
              <div className="pt-4 pb-2">
                <p className="px-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">관리자</p>
              </div>
              <Link to="/admin" onClick={() => setIsMobileMenuOpen(false)}>
                <div className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${isActive('/admin') ? 'bg-primary/10 text-primary' : 'text-gray-400 hover:bg-surface hover:text-gray-200'}`}>
                  <Shield size={18} />
                  봇 관리 패널
                </div>
              </Link>
            </>
          )}
        </nav>

        <div className="p-4 border-t border-border">
          <div className="flex items-center gap-3 mb-4 px-2">
            <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center text-xs font-bold">
              {user.name.charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{user.name}</p>
              <p className="text-xs text-gray-500 truncate">Level {user.level}</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" className="w-full justify-start text-red-400 hover:text-red-300 hover:bg-red-900/20" onClick={handleLogout}>
            <LogOut size={16} className="mr-2" />
            로그아웃
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col relative pt-14 md:pt-0 overflow-y-auto">
        {children}
      </main>
    </div>
  );
};