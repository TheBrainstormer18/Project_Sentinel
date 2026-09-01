import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertOctagon,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Coins,
  Filter,
  RefreshCw,
  ShieldAlert,
  ArrowUpRight,
  Sparkles,
  Search,
  Lock,
} from 'lucide-react';
import { fetchAlerts, updateAlertStatus } from '../services/api';
import { Alert, AlertSeverity, AlertStatus } from '../types';
import { useAuth } from '../context/AuthContext';

export const EarlyWarnings: React.FC = () => {
  const { isAdmin, isOfficer } = useAuth();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [severityFilter, setSeverityFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const loadAlerts = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchAlerts({
        severity: severityFilter,
        status: statusFilter,
      });
      setAlerts(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load early warning alerts');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAlerts();
  }, [severityFilter, statusFilter]);

  const handleStatusChange = async (alertId: string, newStatus: AlertStatus) => {
    if (!isAdmin) {
      alert('Access Denied: Only Administrator role can mark alerts as reviewed or resolved.');
      return;
    }
    try {
      const updated = await updateAlertStatus(alertId, newStatus);
      setAlerts((prev) => prev.map((a) => (a.id === alertId ? updated : a)));
    } catch (err: any) {
      alert('Failed to update alert: ' + err.message);
    }
  };

  const filteredAlerts = alerts.filter((a) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      a.project_name.toLowerCase().includes(q) ||
      a.project_code.toLowerCase().includes(q) ||
      a.message.toLowerCase().includes(q) ||
      a.sector.toLowerCase().includes(q)
    );
  });

  const getAlertBadge = (type: string, severity: AlertSeverity) => {
    if (severity === 'HIGH' || type === 'CRITICAL_RISK') {
      return (
        <span className="inline-flex items-center gap-1 rounded-md bg-rose-100 px-2.5 py-1 text-xs font-bold text-rose-800 border border-rose-200">
          <ShieldAlert className="h-3.5 w-3.5 text-rose-600" />
          <span>🔴 HIGH ALERT</span>
        </span>
      );
    }
    if (type === 'COST_OVERRUN') {
      return (
        <span className="inline-flex items-center gap-1 rounded-md bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-800 border border-amber-200">
          <Coins className="h-3.5 w-3.5 text-amber-600" />
          <span>🟠 COST WARNING</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 rounded-md bg-yellow-100 px-2.5 py-1 text-xs font-bold text-yellow-800 border border-yellow-200">
        <AlertTriangle className="h-3.5 w-3.5 text-yellow-600" />
        <span>🟡 PROGRESS WARNING</span>
      </span>
    );
  };

  return (
    <div id="early-warnings-page" className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="rounded-md bg-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-800 border border-rose-200">
              Prescriptive Intervention Matrix
            </span>
          </div>
          <h1 className="mt-1 text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Early Warning Alerts
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Automated notifications identifying bottleneck anomalies with prescriptive corrective steps
          </p>
        </div>

        <button
          onClick={loadAlerts}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors"
        >
          <RefreshCw className="h-4 w-4" />
          <span>Refresh Alerts</span>
        </button>
      </div>

      {/* Filter and Status Toggles */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row gap-3">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search alerts by project, code, or keyword..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50/60 pl-9 pr-4 py-2 text-xs text-slate-800 focus:border-blue-500 focus:bg-white focus:outline-hidden"
            />
          </div>

          {/* Severity filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-bold text-slate-500 uppercase">Severity:</span>
            <select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value)}
              className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-semibold text-slate-800 focus:outline-hidden"
            >
              <option value="ALL">All Severities</option>
              <option value="HIGH">High Severity</option>
              <option value="MEDIUM">Medium Severity</option>
              <option value="LOW">Low Severity</option>
            </select>
          </div>

          {/* Status filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-bold text-slate-500 uppercase">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-semibold text-slate-800 focus:outline-hidden"
            >
              <option value="ALL">All Statuses</option>
              <option value="NEW">New</option>
              <option value="REVIEWED">Reviewed</option>
              <option value="RESOLVED">Resolved</option>
            </select>
          </div>
        </div>
      </div>

      {/* Alert Feed Cards */}
      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <RefreshCw className="h-6 w-6 animate-spin text-blue-600" />
        </div>
      ) : error ? (
        <div className="p-8 text-center text-rose-600 font-semibold">{error}</div>
      ) : filteredAlerts.length === 0 ? (
        <div className="rounded-2xl border border-slate-200/80 bg-white p-12 text-center shadow-xs">
          <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-500 mb-3" />
          <h3 className="text-base font-bold text-slate-800">No active alerts found</h3>
          <p className="text-xs text-slate-500 mt-1">All monitoring thresholds within acceptable ranges.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredAlerts.map((alert) => (
            <div
              key={alert.id}
              className={`rounded-2xl border bg-white p-5 sm:p-6 shadow-xs transition-all ${
                alert.status === 'RESOLVED'
                  ? 'border-slate-200 bg-slate-50/50 opacity-75'
                  : alert.severity === 'HIGH'
                  ? 'border-rose-200 hover:border-rose-300'
                  : 'border-slate-200/80 hover:border-slate-300'
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                <div className="flex flex-wrap items-center gap-2">
                  {getAlertBadge(alert.alert_type, alert.severity)}
                  <Link
                    to={`/projects/${alert.project_id}`}
                    className="font-bold text-slate-900 hover:text-blue-600 transition-colors text-sm"
                  >
                    {alert.project_name}
                  </Link>
                  <span className="font-mono text-[10px] text-slate-500 font-semibold">
                    ({alert.project_code})
                  </span>
                </div>

                <div className="flex items-center gap-2 text-xs">
                  <span className="text-slate-400 text-[11px]">
                    {new Date(alert.created_at).toLocaleDateString()}
                  </span>

                  {isAdmin ? (
                    <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1 font-semibold text-[11px]">
                      {(['NEW', 'REVIEWED', 'RESOLVED'] as AlertStatus[]).map((st) => (
                        <button
                          key={st}
                          onClick={() => handleStatusChange(alert.id, st)}
                          className={`rounded-md px-2 py-0.5 transition-all ${
                            alert.status === st
                              ? st === 'RESOLVED'
                                ? 'bg-emerald-600 text-white'
                                : st === 'REVIEWED'
                                ? 'bg-blue-600 text-white'
                                : 'bg-rose-600 text-white'
                              : 'text-slate-600 hover:bg-slate-200'
                          }`}
                        >
                          {st}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 rounded-lg bg-slate-100 px-2.5 py-1 font-semibold text-[11px]">
                      <span
                        className={`rounded-full px-2 py-0.5 font-bold ${
                          alert.status === 'RESOLVED'
                            ? 'bg-emerald-100 text-emerald-800'
                            : alert.status === 'REVIEWED'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {alert.status}
                      </span>
                      <span className="text-[10px] text-slate-400 font-normal">
                        (Read-Only)
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Alert Content */}
              <div className="mt-4 grid grid-cols-1 lg:grid-cols-12 gap-4">
                {/* Detected Issue / Explanation */}
                <div className="lg:col-span-6 space-y-1">
                  <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">
                    Detected Anomaly / Risk Factor
                  </span>
                  <p className="text-xs sm:text-sm font-semibold text-slate-800 leading-relaxed bg-slate-50 rounded-xl p-3.5 border border-slate-100">
                    {alert.message}
                  </p>
                </div>

                {/* Recommended Action */}
                <div className="lg:col-span-6 space-y-1">
                  <span className="text-[10px] font-bold uppercase text-blue-600 tracking-wider">
                    Prescriptive Action Plan
                  </span>
                  <p className="text-xs sm:text-sm font-semibold text-blue-950 leading-relaxed bg-blue-50/70 rounded-xl p-3.5 border border-blue-200/80">
                    {alert.recommended_action}
                  </p>
                </div>
              </div>

              <div className="mt-3 flex items-center justify-between text-xs pt-2">
                <span className="text-slate-500 font-medium">Sector: {alert.sector}</span>
                <Link
                  to={`/projects/${alert.project_id}`}
                  className="font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1"
                >
                  <span>Open Project Telemetry</span>
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
