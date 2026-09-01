import React from 'react';
import { Navigate, useLocation, Link } from 'react-router-dom';
import { ShieldAlert, Lock, ArrowLeft, LayoutDashboard, FolderGit2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { UserRole } from '../types';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: UserRole[];
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  allowedRoles,
}) => {
  const { user, isAuthenticated, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-3 border-blue-600 border-t-transparent" />
          <span className="text-xs font-semibold text-slate-500">Verifying session permissions...</span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    // Render an Access Denied / 403 Forbidden screen
    return (
      <div
        id="access-denied-container"
        className="rounded-2xl border border-rose-200 bg-white p-8 shadow-sm text-center max-w-2xl mx-auto my-12"
      >
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-rose-100 text-rose-600">
          <ShieldAlert className="h-8 w-8" />
        </div>
        <div className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-3 py-1 text-xs font-extrabold text-rose-700 border border-rose-200">
          <Lock className="h-3 w-3" />
          <span>HTTP 403: Access Denied</span>
        </div>
        <h2 className="mt-3 text-xl font-black text-slate-900">
          Administrator Privileges Required
        </h2>
        <p className="mt-2 text-xs text-slate-600 leading-relaxed max-w-md mx-auto">
          You are currently logged in as <strong className="text-slate-900">{user.name}</strong> with the{' '}
          <strong className="text-blue-700 font-semibold uppercase">
            {user.role === 'officer' ? 'Monitoring Officer' : user.role}
          </strong>{' '}
          role. Monitoring Officers have read-only access to risk telemetry and are restricted from uploading or modifying project data.
        </p>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <Link
            to="/"
            id="btn-return-dashboard"
            className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-md shadow-blue-600/20 hover:bg-blue-500 transition-all"
          >
            <LayoutDashboard className="h-4 w-4" />
            <span>Return to Dashboard</span>
          </Link>
          <Link
            to="/projects"
            id="btn-return-projects"
            className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 transition-all"
          >
            <FolderGit2 className="h-4 w-4" />
            <span>Explore Projects</span>
          </Link>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};
