import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Lock,
  Mail,
  User as UserIcon,
  Eye,
  EyeOff,
  AlertCircle,
  CheckCircle2,
  Shield,
  ShieldCheck,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { UserRole } from '../types';

type AuthMode = 'signin' | 'register' | 'forgot';

export const Login: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, register, resetPassword, loginDemo, isAuthenticated } = useAuth();

  const [mode, setMode] = useState<AuthMode>('signin');
  const [selectedRole, setSelectedRole] = useState<UserRole>('officer');
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [name, setName] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const from = (location.state as any)?.from?.pathname || '/';

  // If already authenticated, redirect to destination
  useEffect(() => {
    if (isAuthenticated) {
      navigate(from, { replace: true });
    }
  }, [isAuthenticated, navigate, from]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);
    setLoading(true);

    try {
      if (mode === 'forgot') {
        if (!email.trim()) {
          setErrorMessage('Please enter your email address.');
          setLoading(false);
          return;
        }
        await resetPassword(email.trim());
        setSuccessMessage('Password reset link has been sent to your email.');
      } else if (mode === 'register') {
        if (!name.trim()) {
          setErrorMessage('Please enter your full name.');
          setLoading(false);
          return;
        }
        if (!email.trim() || !password) {
          setErrorMessage('Please provide both email and password.');
          setLoading(false);
          return;
        }
        if (password.length < 6) {
          setErrorMessage('Password must be at least 6 characters long.');
          setLoading(false);
          return;
        }
        if (password !== confirmPassword) {
          setErrorMessage('Passwords do not match.');
          setLoading(false);
          return;
        }

        await register(name.trim(), email.trim(), password);
        setSuccessMessage(
          'Account created successfully. Your account has been created as a Project Officer.'
        );
        setSelectedRole('officer');
        setMode('signin');
        setPassword('');
        setConfirmPassword('');
      } else {
        if (!email.trim() || !password) {
          setErrorMessage('Please enter your email and password.');
          setLoading(false);
          return;
        }
        await login(email.trim(), password, selectedRole);
        navigate(from, { replace: true });
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Invalid email or password.');
    } finally {
      setLoading(false);
    }
  };

  const handleDemoClick = async () => {
    setErrorMessage(null);
    setSuccessMessage(null);
    setLoading(true);
    try {
      await loginDemo();
      navigate(from, { replace: true });
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to authenticate with demo account.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden font-sans">
      {/* Subtle Background Elements */}
      <div className="absolute inset-0 bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:24px_24px] opacity-35 pointer-events-none" />
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />

      {/* Brand Header */}
      <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10 text-center">
        <div className="flex h-12 w-12 mx-auto items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-xl shadow-blue-500/20 text-white font-black text-xl tracking-tight border border-blue-400/30">
          S
        </div>
        <h1 className="mt-3 text-2xl font-black tracking-wider text-white uppercase">
          PROJECT SENTINEL
        </h1>
        <p className="mt-0.5 text-xs text-slate-400 font-medium tracking-wide">
          Infrastructure Risk Platform
        </p>
      </div>

      {/* Main Authentication Card */}
      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-md relative z-10 px-4 sm:px-0">
        <div className="bg-slate-900/90 backdrop-blur-md py-7 px-6 sm:px-8 border border-slate-800 shadow-2xl rounded-2xl">
          {/* Card Title */}
          <div className="text-center mb-5">
            <h2 className="text-base font-extrabold text-white tracking-wider uppercase">
              {mode === 'signin' && 'SIGN IN'}
              {mode === 'register' && 'CREATE ACCOUNT'}
              {mode === 'forgot' && 'RESET PASSWORD'}
            </h2>
          </div>

          {/* Error Message banner */}
          {errorMessage && (
            <div
              id="login-error-alert"
              className="mb-4 flex items-start gap-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 p-3 text-xs text-rose-300"
            >
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-400 mt-0.5" />
              <div className="leading-snug">{errorMessage}</div>
            </div>
          )}

          {/* Success Message banner */}
          {successMessage && (
            <div
              id="login-success-alert"
              className="mb-4 flex items-start gap-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 p-3 text-xs text-emerald-300"
            >
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400 mt-0.5" />
              <div className="leading-snug">{successMessage}</div>
            </div>
          )}

          {/* Role Selector Tabs (Only in Sign In Mode) */}
          {mode === 'signin' && (
            <div className="mb-5">
              <div className="grid grid-cols-2 gap-2 p-1 bg-slate-950/60 rounded-xl border border-slate-800/80">
                <button
                  type="button"
                  id="tab-role-admin"
                  onClick={() => {
                    setSelectedRole('admin');
                    setErrorMessage(null);
                  }}
                  className={`py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                    selectedRole === 'admin'
                      ? 'bg-blue-600 text-white shadow-sm shadow-blue-600/30 border border-blue-400/40'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                  }`}
                >
                  <Shield className="h-3.5 w-3.5" />
                  <span>ADMIN</span>
                </button>

                <button
                  type="button"
                  id="tab-role-officer"
                  onClick={() => {
                    setSelectedRole('officer');
                    setErrorMessage(null);
                  }}
                  className={`py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                    selectedRole === 'officer'
                      ? 'bg-blue-600 text-white shadow-sm shadow-blue-600/30 border border-blue-400/40'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                  }`}
                >
                  <ShieldCheck className="h-3.5 w-3.5" />
                  <span>OFFICER</span>
                </button>
              </div>

              {/* Role-Specific Subtle Description */}
              <div className="mt-2.5 text-center min-h-[30px] flex items-center justify-center px-2">
                <p className="text-[11px] text-slate-400 leading-relaxed italic">
                  {selectedRole === 'admin'
                    ? 'Administrator access — Portfolio-wide infrastructure monitoring and management'
                    : 'Project Officer access — Monitor and manage your assigned infrastructure projects'}
                </p>
              </div>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-3.5">
            {/* Name Field (Registration only) */}
            {mode === 'register' && (
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1" htmlFor="name">
                  Name
                </label>
                <div className="relative">
                  <UserIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                  <input
                    id="register-name"
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Dr. Rajesh Verma"
                    className="w-full rounded-xl border border-slate-700 bg-slate-800/80 pl-10 pr-3.5 py-2 text-xs text-white placeholder-slate-500 focus:border-blue-500 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
              </div>
            )}

            {/* Email Field */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1" htmlFor="email">
                Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                <input
                  id="login-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@projectsentinel.ai"
                  className="w-full rounded-xl border border-slate-700 bg-slate-800/80 pl-10 pr-3.5 py-2 text-xs text-white placeholder-slate-500 focus:border-blue-500 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20"
                />
              </div>
            </div>

            {/* Password Field */}
            {mode !== 'forgot' && (
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1" htmlFor="password">
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                  <input
                    id="login-password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full rounded-xl border border-slate-700 bg-slate-800/80 pl-10 pr-10 py-2 text-xs text-white placeholder-slate-500 focus:border-blue-500 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20"
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
            )}

            {/* Confirm Password (Registration only) */}
            {mode === 'register' && (
              <div>
                <label
                  className="block text-xs font-semibold text-slate-300 mb-1"
                  htmlFor="confirm-password"
                >
                  Confirm Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                  <input
                    id="register-confirm-password"
                    type={showConfirmPassword ? 'text' : 'password'}
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full rounded-xl border border-slate-700 bg-slate-800/80 pl-10 pr-10 py-2 text-xs text-white placeholder-slate-500 focus:border-blue-500 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition-colors p-1"
                    aria-label="Toggle confirm password visibility"
                  >
                    {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            )}

            {/* Submit Button */}
            <button
              id="btn-login-submit"
              type="submit"
              disabled={loading}
              className="mt-4 w-full flex items-center justify-center gap-2 rounded-xl bg-blue-600 py-2.5 px-4 text-xs font-bold text-white shadow-lg shadow-blue-600/30 hover:bg-blue-500 transition-all focus:outline-hidden focus:ring-2 focus:ring-blue-400 disabled:opacity-50 tracking-wider uppercase"
            >
              {loading ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              ) : (
                <span>
                  {mode === 'signin' && 'SIGN IN'}
                  {mode === 'register' && 'CREATE ACCOUNT'}
                  {mode === 'forgot' && 'SEND RESET LINK'}
                </span>
              )}
            </button>
          </form>

          {/* Navigation Links */}
          <div className="mt-4 text-center space-y-2">
            {mode === 'signin' && (
              <>
                <div>
                  <button
                    type="button"
                    onClick={() => {
                      setMode('forgot');
                      setErrorMessage(null);
                      setSuccessMessage(null);
                    }}
                    className="text-xs font-medium text-blue-400 hover:text-blue-300 transition-colors"
                  >
                    Forgot password?
                  </button>
                </div>
                <div>
                  <button
                    type="button"
                    onClick={() => {
                      setMode('register');
                      setErrorMessage(null);
                      setSuccessMessage(null);
                    }}
                    className="text-xs font-medium text-slate-400 hover:text-white transition-colors"
                  >
                    Don't have an account?{' '}
                    <span className="text-blue-400 hover:text-blue-300 font-semibold">Create one</span>
                  </button>
                </div>
              </>
            )}

            {mode === 'register' && (
              <button
                type="button"
                onClick={() => {
                  setMode('signin');
                  setErrorMessage(null);
                  setSuccessMessage(null);
                }}
                className="text-xs font-medium text-slate-400 hover:text-white transition-colors"
              >
                Already have an account?{' '}
                <span className="text-blue-400 hover:text-blue-300 font-semibold">Sign In</span>
              </button>
            )}

            {mode === 'forgot' && (
              <button
                type="button"
                onClick={() => {
                  setMode('signin');
                  setErrorMessage(null);
                  setSuccessMessage(null);
                }}
                className="text-xs font-medium text-blue-400 hover:text-blue-300 transition-colors"
              >
                Back to Sign In
              </button>
            )}
          </div>

          {/* Divider */}
          <div className="mt-5 border-t border-slate-800/80 pt-4 text-center">
            <p className="text-xs text-slate-400">
              Want to explore the platform?
            </p>
            <button
              type="button"
              id="btn-use-demo"
              onClick={handleDemoClick}
              disabled={loading}
              className="mt-1 font-bold text-blue-400 hover:text-blue-300 underline underline-offset-2 transition-colors disabled:opacity-50 text-xs"
            >
              Use Demo
            </button>
          </div>
        </div>

        {/* Footer Note */}
        <p className="mt-5 text-center text-xs text-slate-500">
          Project Sentinel AI • MoSPI Infrastructure Monitoring System
        </p>
      </div>
    </div>
  );
};
