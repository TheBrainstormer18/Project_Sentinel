import React, { useEffect, useState } from 'react';
import {
  Users,
  Shield,
  ShieldCheck,
  UserCheck,
  Search,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';
import { fetchUsers, updateUserRole } from '../services/api';
import { UserProfile, UserRole } from '../types';
import { useAuth } from '../context/AuthContext';

export const UserManagement: React.FC = () => {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [search, setSearch] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const loadUsers = async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const data = await fetchUsers();
      setUsers(data);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to fetch user list');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const handleRoleChange = async (targetUser: UserProfile, newRole: UserRole) => {
    if (targetUser.id === currentUser?.id) {
      alert('You cannot change your own administrative role.');
      return;
    }

    const confirmMsg =
      newRole === 'admin'
        ? `Promote "${targetUser.name}" to Administrator? They will receive full permissions to manage users, upload data, and create projects.`
        : `Demote "${targetUser.name}" to Monitoring Officer? Their administrative permissions will be revoked.`;

    if (!window.confirm(confirmMsg)) return;

    setUpdatingId(targetUser.id);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const updated = await updateUserRole(targetUser.id, newRole);
      setUsers((prev) =>
        prev.map((u) => (u.id === targetUser.id ? { ...u, role: updated.role } : u))
      );
      setSuccessMessage(
        `Successfully updated ${targetUser.name}'s role to ${newRole.toUpperCase()}.`
      );
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to update user role');
    } finally {
      setUpdatingId(null);
    }
  };

  const filteredUsers = users.filter(
    (u) =>
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase()) ||
      u.role.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div id="user-management-page" className="space-y-6 pb-12">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2.5">
            <Users className="h-7 w-7 text-blue-600" />
            <span>User & Access Management</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Manage Sentinel monitoring officers, review registered accounts, and configure administrative privileges.
          </p>
        </div>

        <button
          onClick={loadUsers}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 shadow-xs transition-all disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh Users</span>
        </button>
      </div>

      {/* Notifications */}
      {errorMessage && (
        <div className="flex items-start gap-2.5 rounded-xl bg-rose-50 border border-rose-200 p-4 text-xs text-rose-800">
          <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
          <div>{errorMessage}</div>
        </div>
      )}

      {successMessage && (
        <div className="flex items-start gap-2.5 rounded-xl bg-emerald-50 border border-emerald-200 p-4 text-xs text-emerald-800">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 mt-0.5" />
          <div>{successMessage}</div>
        </div>
      )}

      {/* Search & Stats Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, email, or role..."
            className="w-full rounded-xl border border-slate-200 pl-10 pr-3.5 py-2 text-xs text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:outline-hidden focus:ring-2 focus:ring-blue-500/10"
          />
        </div>

        <div className="flex items-center gap-3 text-xs text-slate-500">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-blue-600" />
            Total Accounts: <strong className="text-slate-800 font-bold">{users.length}</strong>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-indigo-600" />
            Admins: <strong className="text-slate-800 font-bold">{users.filter((u) => u.role === 'admin').length}</strong>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-emerald-600" />
            Officers: <strong className="text-slate-800 font-bold">{users.filter((u) => u.role === 'officer').length}</strong>
          </span>
        </div>
      </div>

      {/* Users Table */}
      <div className="rounded-2xl border border-slate-200/80 bg-white shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <th className="py-3.5 px-4 sm:px-6">Officer Name</th>
                <th className="py-3.5 px-4 sm:px-6">Email Address</th>
                <th className="py-3.5 px-4 sm:px-6">Current Role</th>
                <th className="py-3.5 px-4 sm:px-6">Registration Date</th>
                <th className="py-3.5 px-4 sm:px-6 text-right">Role Authorization</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-400">
                    <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-blue-600 border-t-transparent mb-2" />
                    <p>Loading registered profiles from Supabase...</p>
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-400">
                    No registered user accounts found matching your search.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => {
                  const isSelf = u.id === currentUser?.id;
                  const isUpdating = updatingId === u.id;

                  return (
                    <tr key={u.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-4 sm:px-6 font-bold text-slate-900 flex items-center gap-2">
                        <div className="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center font-extrabold text-slate-600 border border-slate-200 text-xs">
                          {u.name ? u.name.charAt(0).toUpperCase() : 'U'}
                        </div>
                        <div>
                          <div>{u.name}</div>
                          {isSelf && (
                            <span className="text-[10px] font-semibold text-blue-600">(Current Session)</span>
                          )}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 sm:px-6 font-mono text-slate-600 text-xs">
                        {u.email}
                      </td>
                      <td className="py-3.5 px-4 sm:px-6">
                        {u.role === 'admin' ? (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-50 border border-indigo-200 px-2.5 py-0.5 text-[11px] font-bold text-indigo-700">
                            <ShieldCheck className="h-3 w-3 text-indigo-600" />
                            <span>Administrator</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700">
                            <UserCheck className="h-3 w-3 text-emerald-600" />
                            <span>Monitoring Officer</span>
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 sm:px-6 text-slate-500">
                        {u.created_at ? new Date(u.created_at).toLocaleDateString() : 'N/A'}
                      </td>
                      <td className="py-3.5 px-4 sm:px-6 text-right">
                        {isSelf ? (
                          <span className="text-slate-400 italic text-[11px]">Protected Self</span>
                        ) : isUpdating ? (
                          <span className="text-blue-600 text-[11px] font-bold animate-pulse">Updating...</span>
                        ) : u.role === 'officer' ? (
                          <button
                            type="button"
                            onClick={() => handleRoleChange(u, 'admin')}
                            className="inline-flex items-center gap-1 rounded-lg border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-[11px] font-bold text-indigo-700 hover:bg-indigo-100 transition-colors shadow-2xs"
                          >
                            <ArrowUpRight className="h-3.5 w-3.5 text-indigo-600" />
                            <span>Promote to Admin</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleRoleChange(u, 'officer')}
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-bold text-slate-600 hover:bg-slate-100 transition-colors shadow-2xs"
                          >
                            <ArrowDownRight className="h-3.5 w-3.5 text-slate-500" />
                            <span>Demote to Officer</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
