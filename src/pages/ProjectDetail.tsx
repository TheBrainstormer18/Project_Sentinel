import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Calendar,
  Building2,
  MapPin,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Coins,
  ShieldAlert,
  Sparkles,
  RefreshCw,
  FileText,
  Activity,
  Layers,
  ChevronRight,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from 'recharts';
import { fetchProjectById, runProjectPrediction } from '../services/api';
import { Project, ProjectMonitoringData } from '../types';
import { RiskBadge } from '../components/RiskBadge';
import { RiskGauge } from '../components/RiskGauge';
import { useAuth } from '../context/AuthContext';

export const ProjectDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { isAdmin } = useAuth();
  const [project, setProject] = useState<Project | null>(null);
  const [history, setHistory] = useState<ProjectMonitoringData[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [recalibrating, setRecalibrating] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  const loadData = async () => {
    if (!id) return;
    try {
      setLoading(true);
      setError(null);
      const data = await fetchProjectById(id);
      setProject(data.project);
      setHistory(data.history);
    } catch (err: any) {
      setError(err.message || 'Failed to load project details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [id]);

  const handleRecalibrate = async () => {
    if (!id) return;
    if (!isAdmin) {
      alert('Access Denied: Only Administrator role can trigger AI risk recalculation.');
      return;
    }
    try {
      setRecalibrating(true);
      const res = await runProjectPrediction(id);
      setProject(res.project);
      setSuccessToast('AI Risk inference recalculation complete: Decision trees evaluated.');
      setTimeout(() => setSuccessToast(null), 4000);
    } catch (err: any) {
      alert('Failed to recalibrate: ' + err.message);
    } finally {
      setRecalibrating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="h-8 w-8 animate-spin text-blue-600" />
          <p className="text-sm font-semibold text-slate-600">Retrieving project monitoring telemetry...</p>
        </div>
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="p-6">
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-rose-800">
          <h3 className="text-base font-bold">Project not found</h3>
          <p className="text-sm mt-1">{error}</p>
          <Link
            to="/projects"
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white"
          >
            <ArrowLeft className="h-4 w-4" /> Back to Project Explorer
          </Link>
        </div>
      </div>
    );
  }

  const mon = project.latest_monitoring;
  const feat = project.features;
  const pred = project.prediction;

  // Chart data for historical milestones
  const chartData = history.map((h) => ({
    date: h.update_date,
    original_cost: h.original_cost,
    revised_cost: h.revised_cost,
    expenditure: h.expenditure,
    physical_progress: h.physical_progress,
    financial_progress: h.financial_progress,
  }));

  return (
    <div id="project-detail-page" className="space-y-6 pb-12">
      {/* Navigation Breadcrumb */}
      <div className="flex items-center justify-between">
        <Link
          to="/projects"
          className="inline-flex items-center gap-2 text-xs font-bold text-slate-600 hover:text-blue-600 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to All Projects</span>
        </Link>

        <div className="flex items-center gap-2">
          {isAdmin ? (
            <button
              onClick={handleRecalibrate}
              disabled={recalibrating}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-2 text-xs font-bold text-white shadow-md shadow-blue-500/20 hover:from-blue-500 hover:to-indigo-500 transition-all disabled:opacity-50"
            >
              <Sparkles className={`h-4 w-4 ${recalibrating ? 'animate-spin' : ''}`} />
              <span>{recalibrating ? 'Recalibrating Model...' : 'Run AI Recalibration'}</span>
            </button>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-500" title="Only Administrators can trigger manual model recalibration">
              <Sparkles className="h-3.5 w-3.5 text-slate-400" />
              <span>AI Recalibration (Admin Only)</span>
            </span>
          )}
        </div>
      </div>

      {successToast && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-bold text-emerald-800 flex items-center gap-2 shadow-xs animate-in fade-in duration-200">
          <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
          <span>{successToast}</span>
        </div>
      )}

      {/* Project Header Card */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className="rounded-md bg-slate-900 px-2 py-0.5 font-mono text-[11px] font-bold text-white">
                {project.project_code}
              </span>
              <span className="rounded-md bg-blue-50 px-2.5 py-0.5 text-xs font-bold text-blue-700 border border-blue-200">
                {project.sector}
              </span>
              <span
                className={`rounded-md px-2.5 py-0.5 text-xs font-bold border ${
                  project.data_source === 'Official Data'
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                    : 'bg-slate-100 text-slate-700 border-slate-200'
                }`}
              >
                {project.data_source}
              </span>
              <span className="rounded-md bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700">
                Status: {project.project_status}
              </span>
            </div>

            <h1 className="text-xl sm:text-2xl lg:text-3xl font-extrabold text-slate-900 tracking-tight">
              {project.project_name}
            </h1>

            <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-slate-600">
              <div className="flex items-center gap-1.5 font-medium">
                <Building2 className="h-4 w-4 text-slate-400" />
                <span>{project.ministry}</span>
              </div>
              <div className="flex items-center gap-1.5 font-medium">
                <Layers className="h-4 w-4 text-slate-400" />
                <span>{project.implementing_agency}</span>
              </div>
              <div className="flex items-center gap-1.5 font-medium">
                <MapPin className="h-4 w-4 text-slate-400" />
                <span>{project.state}</span>
              </div>
            </div>
          </div>

          <div className="flex lg:flex-col items-center lg:items-end justify-between border-t lg:border-t-0 border-slate-100 pt-3 lg:pt-0">
            <RiskBadge
              level={pred?.risk_level || 'LOW'}
              score={pred?.risk_score}
              size="lg"
            />
            <span className="text-[11px] text-slate-500 mt-1 font-medium">
              Last Evaluated: {pred?.prediction_date || 'Today'}
            </span>
          </div>
        </div>
      </div>

      {/* AI Risk Analysis Hero Grid (40% Delay + 30% Cost + 20% Progress Gap + 10% Rules) */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left: Overall Risk Score Gauge */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs lg:col-span-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-900">Composite Risk Score</h2>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Hybrid Engine
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Weighted calculation: 40% Delay + 30% Cost + 20% Gap + 10% Rules
            </p>
          </div>

          <div className="my-6 flex justify-center">
            <RiskGauge
              score={pred?.risk_score ?? 0}
              level={pred?.risk_level || 'LOW'}
              delayProb={pred?.delay_probability}
              costProb={pred?.cost_overrun_probability}
              size="lg"
            />
          </div>

          <div className="rounded-xl bg-slate-50 border border-slate-100 p-3 text-[11px] text-slate-600 space-y-1">
            <div className="flex justify-between font-semibold">
              <span>Delay Probability (40%):</span>
              <span className="font-mono text-slate-900 font-bold">{pred?.delay_probability}%</span>
            </div>
            <div className="flex justify-between font-semibold">
              <span>Cost Overrun Prob (30%):</span>
              <span className="font-mono text-slate-900 font-bold">{pred?.cost_overrun_probability}%</span>
            </div>
            <div className="flex justify-between font-semibold">
              <span>Progress Gap Weight (20%):</span>
              <span className="font-mono text-slate-900 font-bold">+{feat?.progress_gap}%</span>
            </div>
          </div>
        </div>

        {/* Right: Explainable AI "Why is this risky?" and Prescriptive Recommended Action */}
        <div className="space-y-6 lg:col-span-8 flex flex-col">
          {/* Why is this risky? */}
          <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs flex-1">
            <div className="flex items-center gap-2 mb-3">
              <ShieldAlert className="h-5 w-5 text-rose-600" />
              <h2 className="text-base font-bold text-slate-900">
                Why is this project risky? (Explainable AI)
              </h2>
            </div>

            <div className="space-y-2.5">
              {(pred?.top_risk_factors || []).map((factor, idx) => (
                <div
                  key={idx}
                  className="flex items-start gap-3 rounded-xl bg-slate-50 border border-slate-200/70 p-3.5"
                >
                  <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-rose-100 text-rose-700 text-xs font-black mt-0.5">
                    {idx + 1}
                  </div>
                  <p className="text-xs font-semibold text-slate-800 leading-relaxed">
                    {factor}
                  </p>
                </div>
              ))}
            </div>

            {/* Feature Contributions Breakdown */}
            {pred?.feature_contributions && pred.feature_contributions.length > 0 && (
              <div className="mt-4 pt-4 border-t border-slate-100">
                <span className="text-[11px] font-bold uppercase text-slate-500 tracking-wider">
                  Relative Risk Feature Drivers
                </span>
                <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {pred.feature_contributions.map((fc, i) => (
                    <div
                      key={i}
                      className="rounded-lg bg-blue-50/50 border border-blue-100/80 p-2.5 text-xs"
                    >
                      <div className="flex justify-between font-bold text-slate-900">
                        <span>{fc.feature}</span>
                        <span className="font-mono text-blue-700">{fc.value}</span>
                      </div>
                      <p className="text-[10px] text-slate-500 mt-0.5 leading-tight">
                        {fc.explanation}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Recommended Action System */}
          <div className="rounded-2xl border border-blue-200 bg-gradient-to-br from-blue-50 to-indigo-50/50 p-6 shadow-xs">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle2 className="h-5 w-5 text-blue-600" />
              <h2 className="text-base font-bold text-blue-950">
                Prescriptive Recommended Action
              </h2>
            </div>
            <p className="text-xs sm:text-sm font-semibold text-blue-900 leading-relaxed bg-white/70 rounded-xl p-4 border border-blue-200/80">
              {pred?.recommended_action}
            </p>
          </div>
        </div>
      </div>

      {/* Financial & Timeline Metrics Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Cost Comparison */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs">
          <span className="text-[11px] font-bold uppercase text-slate-500 tracking-wider">
            Cost Baseline vs Revised
          </span>
          <div className="mt-2 space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-slate-500">Original Cost:</span>
              <span className="font-mono font-semibold text-slate-800">
                ₹{(mon?.original_cost || 0).toLocaleString()} Cr
              </span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-slate-500">Revised Cost:</span>
              <span className="font-mono font-bold text-slate-900">
                ₹{(mon?.revised_cost || 0).toLocaleString()} Cr
              </span>
            </div>
            <div className="flex justify-between text-xs pt-1 border-t border-slate-100 font-bold">
              <span className="text-rose-600">Cost Overrun:</span>
              <span className="text-rose-600 font-mono">
                +{feat?.cost_overrun_pct}% (₹{feat?.cost_growth} Cr)
              </span>
            </div>
          </div>
        </div>

        {/* Expenditure & Financial Progress */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs">
          <span className="text-[11px] font-bold uppercase text-slate-500 tracking-wider">
            Expenditure Disbursed
          </span>
          <div className="mt-2 space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-slate-500">Total Expenditure:</span>
              <span className="font-mono font-bold text-blue-700">
                ₹{(mon?.expenditure || 0).toLocaleString()} Cr
              </span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-slate-500">Financial Progress:</span>
              <span className="font-mono font-bold text-slate-900">
                {feat?.financial_progress}%
              </span>
            </div>
            <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden mt-2">
              <div
                className="h-full bg-blue-600 rounded-full"
                style={{ width: `${Math.min(100, feat?.financial_progress || 0)}%` }}
              />
            </div>
          </div>
        </div>

        {/* Physical Progress & Gap */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs">
          <span className="text-[11px] font-bold uppercase text-slate-500 tracking-wider">
            Physical Ground Delivery
          </span>
          <div className="mt-2 space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-slate-500">Physical Progress:</span>
              <span className="font-mono font-bold text-emerald-700">
                {mon?.physical_progress}%
              </span>
            </div>
            <div className="flex justify-between text-xs font-bold pt-1">
              <span className="text-amber-700">Progress Gap (Fin - Phys):</span>
              <span className="font-mono text-amber-700">+{feat?.progress_gap}%</span>
            </div>
            <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden mt-2">
              <div
                className="h-full bg-emerald-500 rounded-full"
                style={{ width: `${mon?.physical_progress || 0}%` }}
              />
            </div>
          </div>
        </div>

        {/* Timeline Schedules */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs">
          <span className="text-[11px] font-bold uppercase text-slate-500 tracking-wider">
            Target Completion Milestone
          </span>
          <div className="mt-2 space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-slate-500">Original Target:</span>
              <span className="font-mono font-medium text-slate-700">
                {mon?.original_completion_date}
              </span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-slate-500">Revised Target:</span>
              <span className="font-mono font-bold text-slate-900">
                {mon?.revised_completion_date}
              </span>
            </div>
            <div className="flex justify-between text-xs pt-1 border-t border-slate-100 font-bold">
              <span className="text-amber-700">Schedule Slippage:</span>
              <span className="font-mono text-amber-700">
                +{feat?.timeline_revision_months} Months
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Historical Monthly Telemetry Chart */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-bold text-slate-900">Monthly Historical Monitoring Telemetry</h2>
            <p className="text-xs text-slate-500">Time-series tracking of cost growth and progress divergence</p>
          </div>
        </div>

        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="colorCost" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorExp" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#64748b' }} />
              <YAxis tick={{ fontSize: 11, fill: '#64748b' }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#0f172a',
                  borderRadius: '10px',
                  color: '#fff',
                  fontSize: '12px',
                  border: 'none',
                }}
              />
              <Area
                type="monotone"
                dataKey="revised_cost"
                name="Revised Cost (₹ Cr)"
                stroke="#3b82f6"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#colorCost)"
              />
              <Area
                type="monotone"
                dataKey="expenditure"
                name="Expenditure (₹ Cr)"
                stroke="#10b981"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#colorExp)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};
