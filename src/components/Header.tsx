import React from 'react';
import { Menu, ShieldAlert, Database, Bell, Search, Sparkles, User, RefreshCw, LogOut } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

interface HeaderProps {
  onToggleSidebar: () => void;
  highRiskCount?: number;
  newAlertCount?: number;
}

export const Header: React.FC<HeaderProps> = ({
  onToggleSidebar,
  highRiskCount = 0,
  newAlertCount = 0,
}) => {
  const navigate = useNavigate();
  const { user, isAdmin, logout, switchRoleDemo } = useAuth();
  const [searchVal, setSearchVal] = React.useState('');

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchVal.trim()) {
      navigate(`/projects?search=${encodeURIComponent(searchVal.trim())}`);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <header
      id="top-header"
      className="sticky top-0 z-20 flex h-16 w-full items-center justify-between border-b border-slate-200/80 bg-white/90 px-4 sm:px-6 backdrop-blur-md"
    >
      <div className="flex items-center gap-3">
        <button
          id="btn-sidebar-toggle"
          onClick={onToggleSidebar}
          className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors focus:outline-hidden"
          aria-label="Toggle Navigation"
        >
          <Menu className="h-5 w-5" />
        </button>

        {/* Global Search Bar */}
        <form onSubmit={handleSearchSubmit} className="relative hidden md:block w-72 lg:w-96">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            id="global-project-search"
            type="text"
            placeholder="Search projects by name, code, ministry..."
            value={searchVal}
            onChange={(e) => setSearchVal(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-slate-50/70 pl-9 pr-4 py-1.5 text-xs text-slate-800 placeholder-slate-400 transition-all focus:border-blue-500 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-100"
          />
        </form>
      </div>

      <div className="flex items-center gap-2.5 sm:gap-4">
        {/* Data Source Badge */}
        <div className="hidden lg:flex items-center gap-1.5 rounded-full border border-blue-200/80 bg-blue-50/70 px-3 py-1 text-xs font-semibold text-blue-800">
          <Database className="h-3.5 w-3.5 text-blue-600" />
          <span>MoSPI / PAIMANA</span>
        </div>

        {/* High Risk Alert Badge */}
        {highRiskCount > 0 && (
          <Link
            to="/projects?risk_level=HIGH"
            id="header-high-risk-indicator"
            className="flex items-center gap-1.5 rounded-full border border-rose-200 bg-rose-50 px-2.5 sm:px-3 py-1 text-xs font-bold text-rose-700 hover:bg-rose-100 transition-colors"
          >
            <ShieldAlert className="h-3.5 w-3.5 text-rose-600 animate-pulse" />
            <span className="hidden sm:inline">{highRiskCount} High Risk</span>
            <span className="sm:hidden">{highRiskCount}</span>
          </Link>
        )}

        {/* Early Warnings Bell */}
        <Link
          to="/alerts"
          id="header-alert-bell"
          className="relative rounded-xl border border-slate-200 p-2 text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors"
          aria-label="View Alerts"
        >
          <Bell className="h-4 w-4" />
          {newAlertCount > 0 && (
            <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-600 px-1 text-[9px] font-black text-white shadow-xs">
              {newAlertCount}
            </span>
          )}
        </Link>

        {/* User Identity & Role Badge */}
        {user ? (
          <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
            <div className="hidden sm:flex flex-col text-right">
              <span className="text-xs font-bold text-slate-800 truncate max-w-[130px]">
                {user.name.split(' ')[0]}
              </span>
              <span className="text-[10px] text-slate-500">
                {user.role === 'admin' ? 'Administrator' : 'Monitoring Officer'}
              </span>
            </div>

            <div
              id="header-user-badge"
              className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-extrabold border ${
                isAdmin
                  ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                  : 'bg-emerald-50 text-emerald-700 border-emerald-200'
              }`}
            >
              <div
                className={`h-2 w-2 rounded-full ${
                  isAdmin ? 'bg-indigo-600' : 'bg-emerald-600'
                }`}
              />
              <span className="uppercase text-[10px] tracking-wide">
                {user.role}
              </span>
            </div>

            {/* Quick Role Switcher for Hackathon Demo */}
            <button
              type="button"
              id="btn-header-switch-role"
              onClick={() => switchRoleDemo(isAdmin ? 'officer' : 'admin')}
              className="hidden md:flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors"
              title={`Switch to ${isAdmin ? 'Monitoring Officer' : 'Administrator'} demo mode`}
            >
              <RefreshCw className="h-3 w-3 text-slate-400" />
              <span>Switch to {isAdmin ? 'Officer' : 'Admin'}</span>
            </button>
          </div>
        ) : (
          <Link
            to="/login"
            id="btn-header-login"
            className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-3 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-blue-500 transition-colors"
          >
            <User className="h-3.5 w-3.5" />
            <span>Sign In</span>
          </Link>
        )}
      </div>
    </header>
  );
};
