import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  FolderGit2,
  AlertOctagon,
  BrainCircuit,
  UploadCloud,
  Activity,
  ChevronRight,
  Sparkles,
  LogOut,
  UserCheck,
  ShieldCheck,
  RefreshCw,
  Users,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface SidebarProps {
  highRiskCount?: number;
  newAlertCount?: number;
  isOpen: boolean;
  onToggle: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  highRiskCount = 0,
  newAlertCount = 0,
  isOpen,
  onToggle,
}) => {
  const { user, isAdmin, isOfficer, logout } = useAuth();
  const navigate = useNavigate();

  const allNavItems = [
    {
      name: 'Dashboard',
      path: '/',
      icon: LayoutDashboard,
      badge: null,
      adminOnly: false,
      description: 'Executive overview & risk distributions',
    },
    {
      name: 'Projects',
      path: '/projects',
      icon: FolderGit2,
      badge: highRiskCount > 0 ? `${highRiskCount} High` : null,
      badgeColor: 'bg-rose-100 text-rose-800 border-rose-200',
      adminOnly: false,
      description: 'Project portfolio explorer & filters',
    },
    {
      name: 'Early Warnings',
      path: '/alerts',
      icon: AlertOctagon,
      badge: newAlertCount > 0 ? `${newAlertCount} New` : null,
      badgeColor: 'bg-amber-100 text-amber-800 border-amber-200',
      adminOnly: false,
      description: 'Prescriptive action & alert matrix',
    },
    {
      name: 'Model Insights',
      path: '/model-insights',
      icon: BrainCircuit,
      badge: 'v2.4 RF',
      badgeColor: 'bg-blue-100 text-blue-800 border-blue-200',
      adminOnly: false,
      description: 'ML comparisons & feature importance',
    },
    {
      name: 'Data Upload',
      path: '/upload',
      icon: UploadCloud,
      badge: 'Admin Only',
      badgeColor: 'bg-indigo-900/60 text-indigo-200 border-indigo-700/50',
      adminOnly: true,
      description: 'Data ingestion & validation pipeline',
    },
    {
      name: 'User Management',
      path: '/users',
      icon: Users,
      badge: 'Admin Only',
      badgeColor: 'bg-indigo-900/60 text-indigo-200 border-indigo-700/50',
      adminOnly: true,
      description: 'Role permissions & officer directory',
    },
  ];

  // RBAC: Monitoring Officer sees only non-admin routes
  const visibleNavItems = allNavItems.filter((item) => {
    if (item.adminOnly && isOfficer) return false;
    return true;
  });

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {isOpen && (
        <div
          id="sidebar-mobile-backdrop"
          onClick={onToggle}
          className="fixed inset-0 z-25 bg-slate-950/60 backdrop-blur-xs transition-opacity lg:hidden"
        />
      )}

      <aside
        id="main-sidebar"
        className={`fixed inset-y-0 left-0 z-30 flex flex-col bg-slate-900 text-slate-200 transition-all duration-300 border-r border-slate-800 ${
          isOpen ? 'translate-x-0 w-64' : '-translate-x-full w-64 lg:translate-x-0 lg:w-20'
        } lg:static`}
      >
        {/* Brand Header */}
        <div className="flex h-18 items-center px-4 border-b border-slate-800/80 justify-between">
          <NavLink to="/" className="flex items-center gap-3 overflow-hidden">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-md shadow-blue-500/20 text-white font-black text-xl tracking-tight">
              S
            </div>
            {(isOpen || undefined) && (
              <div className={`flex flex-col truncate ${!isOpen ? 'hidden' : 'flex'}`}>
                <div className="flex items-center gap-1.5 font-bold text-white tracking-tight text-base">
                  <span>Project Sentinel</span>
                  <span className="inline-flex items-center rounded-sm bg-blue-500/20 px-1 py-0.2 text-[10px] font-extrabold text-blue-400 border border-blue-500/30">
                    AI
                  </span>
                </div>
                <span className="text-[11px] text-slate-400 font-medium tracking-wide">
                  Predict • Explain • Warn • Act
                </span>
              </div>
            )}
          </NavLink>
        </div>

        {/* Nav Links */}
        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-1.5">
          {visibleNavItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                id={`nav-link-${item.name.toLowerCase().replace(/\s+/g, '-')}`}
                to={item.path}
                end={item.path === '/'}
                className={({ isActive }) =>
                  `group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-all duration-150 ${
                    isActive
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-600/25'
                      : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <Icon
                      className={`h-5 w-5 shrink-0 transition-transform duration-200 group-hover:scale-110 ${
                        isActive ? 'text-white' : 'text-slate-400 group-hover:text-blue-400'
                      }`}
                    />
                    {isOpen && (
                      <div className="flex flex-1 items-center justify-between truncate">
                        <span className="truncate">{item.name}</span>
                        {item.badge && (
                          <span
                            className={`ml-2 rounded-full border px-1.5 py-0.5 text-[10px] font-bold ${
                              isActive
                                ? 'bg-white/20 text-white border-white/30'
                                : item.badgeColor || 'bg-slate-800 text-slate-300 border-slate-700'
                            }`}
                          >
                            {item.badge}
                          </span>
                        )}
                      </div>
                    )}
                  </>
                )}
              </NavLink>
            );
          })}
        </div>

        {/* User Profile & Role Card at bottom */}
        {user && (
          <div className="p-3 border-t border-slate-800/80 space-y-2">
            {isOpen ? (
              <div
                id="sidebar-user-card"
                className="rounded-xl bg-slate-800/80 border border-slate-700/70 p-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 truncate">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-700 text-slate-200 font-bold text-xs">
                      {user.name.charAt(0)}
                    </div>
                    <div className="truncate">
                      <div className="text-xs font-bold text-white truncate">{user.name}</div>
                      <div className="text-[10px] text-slate-400 truncate">{user.email}</div>
                    </div>
                  </div>

                  {/* Role Badge */}
                  <span
                    id="sidebar-user-role-badge"
                    className={`shrink-0 rounded-md px-1.5 py-0.5 text-[9px] font-extrabold tracking-wider uppercase border ${
                      isAdmin
                        ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30'
                        : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                    }`}
                  >
                    {isAdmin ? 'ADMIN' : 'OFFICER'}
                  </span>
                </div>

                {/* Logout Controls */}
                <div className="mt-2.5 flex items-center justify-end border-t border-slate-700/60 pt-2 text-[10px]">
                  <button
                    type="button"
                    id="btn-sidebar-logout"
                    onClick={handleLogout}
                    className="flex items-center gap-1 font-semibold text-rose-400 hover:text-rose-300 transition-colors"
                    title="Sign Out"
                  >
                    <LogOut className="h-3 w-3" />
                    <span>Logout</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <button
                  type="button"
                  onClick={handleLogout}
                  className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-rose-400 transition-colors"
                  title="Logout"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>
        )}
      </aside>
    </>
  );
};
