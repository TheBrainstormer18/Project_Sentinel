import React, { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import {
  ShieldAlert,
  Lock,
  Mail,
  User as UserIcon,
  Eye,
  EyeOff,
  CheckCircle2,
  ShieldCheck,
  Building2,
  Sparkles,
  ArrowRight,
  AlertCircle,
  HelpCircle,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { UserRole } from '../types';

export const Login: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, register, isAuthenticated, user } = useAuth();

  const [isRegisterMode, setIsRegisterMode] = useState<boolean>(false);
  const [email, setEmail] = useState<string>('admin@projectsentinel.ai');
  const [password, setPassword] = useState<string>('Admin123');
  const [name, setName] = useState<string>('');
  const [role, setRole] = useState<UserRole>('officer');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // If already authenticated and visiting login page directly, allow redirecting or switching
  const from = (location.state as any)?.from?.pathname || '/';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setLoading(true);

    try {
      if (isRegisterMode) {
        if (!name.trim()) {
          setErrorMessage('Please enter your full name');
          setLoading(false);
          return;
        }
        await register(name.trim(), email.trim(), password, role);
      } else {
        await login(email.trim(), password);
      }
      navigate(from, { replace: true });
    } catch (err: any) {
      setErrorMessage(err.message || 'Authentication failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectDemoAccount = (demoEmail: string, demoPass: string) => {
    setIsRegisterMode(false);
    setEmail(demoEmail);
    setPassword(demoPass);
    setErrorMessage(null);
  };

  const handleQuickDemoLogin = async (demoEmail: string, demoPass: string) => {
    setIsRegisterMode(false);
    setEmail(demoEmail);
    setPassword(demoPass);
    setErrorMessage(null);
    setLoading(true);
    try {
      await login(demoEmail, demoPass);
      navigate(from, { replace: true });
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to log in with demo account.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Background Subtle Accent Grids */}
      <div className="absolute inset-0 bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:24px_24px] opacity-40 pointer-events-none" />
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10">
        {/* Brand Logo & Name */}
        <div className="flex flex-col items-center text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-xl shadow-blue-500/20 text-white font-black text-2xl tracking-tight border border-blue-400/30">
            S
          </div>
          <div className="mt-4 flex items-center gap-2">
            <h1 className="text-2xl font-black tracking-tight text-white">Project Sentinel</h1>
            <span className="inline-flex items-center rounded-md bg-blue-500/20 px-2 py-0.5 text-xs font-extrabold text-blue-400 border border-blue-500/30">
              AI
            </span>
          </div>
          <p className="mt-1.5 text-xs text-slate-400 max-w-sm">
            AI-Powered Infrastructure Risk Prediction & Early Warning System
          </p>
        </div>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md relative z-10 px-4 sm:px-0">
        <div className="bg-slate-900/90 backdrop-blur-md py-8 px-6 sm:px-8 border border-slate-800 shadow-2xl rounded-2xl">
          {/* Header Title */}
          <div className="mb-6 border-b border-slate-800/80 pb-4">
            <h2 className="text-lg font-bold text-white tracking-tight">
              {isRegisterMode ? 'Create New Sentinel Account' : 'Sign In to Your Workspace'}
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              {isRegisterMode
                ? 'Register as an Administrator or Monitoring Officer'
                : 'Enter your credentials to access risk models and telemetry'}
            </p>
          </div>

          {/* Error Message banner */}
          {errorMessage && (
            <div
              id="login-error-alert"
              className="mb-5 flex items-start gap-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 p-3 text-xs text-rose-300"
            >
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-400 mt-0.5" />
              <div>
                <div className="font-bold">Authentication Error</div>
                <div className="mt-0.5 text-rose-300/90 leading-snug">{errorMessage}</div>
              </div>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {isRegisterMode && (
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5" htmlFor="name">
                  Full Name & Designation
                </label>
                <div className="relative">
                  <UserIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                  <input
                    id="register-name"
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Dr. Rajesh Verma"
                    className="w-full rounded-xl border border-slate-700 bg-slate-800/80 pl-10 pr-3.5 py-2.5 text-xs text-white placeholder-slate-500 transition-all focus:border-blue-500 focus:bg-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5" htmlFor="email">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                <input
                  id="login-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@projectsentinel.ai"
                  className="w-full rounded-xl border border-slate-700 bg-slate-800/80 pl-10 pr-3.5 py-2.5 text-xs text-white placeholder-slate-500 transition-all focus:border-blue-500 focus:bg-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-slate-300" htmlFor="password">
                  Password
                </label>
                {!isRegisterMode && (
                  <span className="text-[11px] text-slate-500">
                    Case-sensitive
                  </span>
                )}
              </div>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-xl border border-slate-700 bg-slate-800/80 pl-10 pr-10 py-2.5 text-xs text-white placeholder-slate-500 transition-all focus:border-blue-500 focus:bg-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition-colors p-1"
                  aria-label="Toggle password visibility"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {isRegisterMode && (
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Assigned User Role
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setRole('officer')}
                    className={`rounded-xl border p-2.5 text-left transition-all ${
                      role === 'officer'
                        ? 'border-blue-500 bg-blue-500/10 text-white shadow-xs'
                        : 'border-slate-700 bg-slate-800 text-slate-400 hover:border-slate-600'
                    }`}
                  >
                    <div className="text-xs font-bold text-white">Monitoring Officer</div>
                    <div className="text-[10px] text-slate-400 mt-0.5">Read-only risk telemetry</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setRole('admin')}
                    className={`rounded-xl border p-2.5 text-left transition-all ${
                      role === 'admin'
                        ? 'border-indigo-500 bg-indigo-500/10 text-white shadow-xs'
                        : 'border-slate-700 bg-slate-800 text-slate-400 hover:border-slate-600'
                    }`}
                  >
                    <div className="text-xs font-bold text-white">Administrator</div>
                    <div className="text-[10px] text-slate-400 mt-0.5">Full upload & edit access</div>
                  </button>
                </div>
              </div>
            )}

            <button
              id="btn-login-submit"
              type="submit"
              disabled={loading}
              className="mt-2 w-full flex items-center justify-center gap-2 rounded-xl bg-blue-600 py-2.5 px-4 text-xs font-bold text-white shadow-lg shadow-blue-600/30 hover:bg-blue-500 transition-all focus:outline-hidden focus:ring-2 focus:ring-blue-400 disabled:opacity-50"
            >
              {loading ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              ) : (
                <>
                  <span>{isRegisterMode ? 'Create Account' : 'Sign In'}</span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>

          {/* Toggle between Login and Register */}
          <div className="mt-4 text-center">
            <button
              type="button"
              onClick={() => {
                setIsRegisterMode(!isRegisterMode);
                setErrorMessage(null);
              }}
              className="text-xs font-medium text-blue-400 hover:text-blue-300 transition-colors"
            >
              {isRegisterMode
                ? 'Already have an account? Sign in'
                : 'Need another account? Register new user'}
            </button>
          </div>

          {/* Hackathon Demo Credentials Section */}
          <div className="mt-6 border-t border-slate-800/80 pt-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="h-3 w-3 text-amber-400" />
                Hackathon Demo Accounts
              </span>
              <span className="text-[10px] font-semibold text-slate-500">1-Click Auto Login</span>
            </div>

            <div className="space-y-2.5">
              {/* Admin Card */}
              <div
                id="demo-admin-card"
                className="group rounded-xl border border-slate-700/80 bg-slate-800/50 p-3 hover:border-blue-500/60 hover:bg-slate-800 transition-all"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center rounded-md bg-indigo-500/20 px-2 py-0.5 text-[10px] font-extrabold text-indigo-300 border border-indigo-500/30">
                      ROLE: ADMIN
                    </span>
                    <span className="text-xs font-bold text-white">System Administrator</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleQuickDemoLogin('admin@projectsentinel.ai', 'Admin123')}
                    className="rounded-lg bg-blue-600/20 px-2.5 py-1 text-[11px] font-bold text-blue-300 hover:bg-blue-600 hover:text-white transition-all border border-blue-500/30"
                  >
                    Quick Login
                  </button>
                </div>
                <div className="mt-1.5 flex flex-wrap items-center gap-x-3 text-[11px] text-slate-400">
                  <span>
                    Email: <code className="text-slate-300">admin@projectsentinel.ai</code>
                  </span>
                  <span>
                    Pass: <code className="text-slate-300">Admin123</code>
                  </span>
                </div>
                <p className="mt-1 text-[10px] text-slate-400">
                  • Full permissions: Upload CSV/XLSX data, recalculate AI risks, resolve alerts, view all dashboards.
                </p>
              </div>

              {/* Monitoring Officer Card */}
              <div
                id="demo-officer-card"
                className="group rounded-xl border border-slate-700/80 bg-slate-800/50 p-3 hover:border-emerald-500/60 hover:bg-slate-800 transition-all"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center rounded-md bg-emerald-500/20 px-2 py-0.5 text-[10px] font-extrabold text-emerald-300 border border-emerald-500/30">
                      ROLE: OFFICER
                    </span>
                    <span className="text-xs font-bold text-white">Monitoring Officer</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleQuickDemoLogin('officer@projectsentinel.ai', 'Officer123')}
                    className="rounded-lg bg-emerald-600/20 px-2.5 py-1 text-[11px] font-bold text-emerald-300 hover:bg-emerald-600 hover:text-white transition-all border border-emerald-500/30"
                  >
                    Quick Login
                  </button>
                </div>
                <div className="mt-1.5 flex flex-wrap items-center gap-x-3 text-[11px] text-slate-400">
                  <span>
                    Email: <code className="text-slate-300">officer@projectsentinel.ai</code>
                  </span>
                  <span>
                    Pass: <code className="text-slate-300">Officer123</code>
                  </span>
                </div>
                <p className="mt-1 text-[10px] text-slate-400">
                  • Monitoring permissions: View executive summaries, multi-vector risk scores, AI alerts, and projects (Upload disabled).
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Note */}
        <p className="mt-6 text-center text-xs text-slate-500">
          Project Sentinel AI • MoSPI Infrastructure Monitoring System
        </p>
      </div>
    </div>
  );
};
