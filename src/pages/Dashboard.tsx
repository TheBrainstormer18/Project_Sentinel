import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowUpRight,
  Clock,
  Coins,
  FileSpreadsheet,
  Layers,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  TrendingUp,
  TrendingDown,
  Activity,
  Sparkles,
  ChevronRight,
  Calendar,
  Filter,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  CartesianGrid,
  ScatterChart,
  Scatter,
  ZAxis,
  LineChart,
  Line,
  Legend,
} from 'recharts';
import { fetchDashboard } from '../services/api';
import { DashboardSummary } from '../types';
import { RiskBadge } from '../components/RiskBadge';
import { RiskGauge } from '../components/RiskGauge';

export const Dashboard: React.FC = () => {
  const [data, setData] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [trendMetricMode, setTrendMetricMode] = useState<'all' | 'high_risk' | 'avg_score'>('all');

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetchDashboard();
      setData(res);
    } catch (err: any) {
      setError(err.message || 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="h-8 w-8 animate-spin text-blue-600" />
          <p className="text-sm font-semibold text-slate-600">Running AI Risk Inferences...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-6">
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-rose-800">
          <div className="flex items-center gap-3">
            <ShieldAlert className="h-6 w-6 text-rose-600" />
            <h3 className="text-base font-bold">Failed to load infrastructure dashboard</h3>
          </div>
          <p className="mt-2 text-sm text-rose-700">{error}</p>
          <button
            onClick={loadData}
            className="mt-4 rounded-xl bg-rose-600 px-4 py-2 text-xs font-bold text-white hover:bg-rose-700"
          >
            Retry Connection
          </button>
        </div>
      </div>
    );
  }

  // Risk distribution for donut chart
  const riskPieData = [
    { name: 'Low Risk (0-30)', value: data.risk_distribution.low, color: '#10b981' },
    { name: 'Medium Risk (31-60)', value: data.risk_distribution.medium, color: '#f59e0b' },
    { name: 'High Risk (61-100)', value: data.risk_distribution.high, color: '#f43f5e' },
  ];

  // 6-Month Trend calculations
  const trends = data.risk_trends || [];
  const firstMonth = trends.length > 0 ? trends[0] : null;
  const lastMonth = trends.length > 0 ? trends[trends.length - 1] : null;
  const highRiskStart = firstMonth?.high_risk_projects ?? 0;
  const highRiskEnd = lastMonth?.high_risk_projects ?? 0;
  const highRiskDiff = highRiskEnd - highRiskStart;
  const highRiskPct = highRiskStart > 0 ? Math.round(((highRiskEnd - highRiskStart) / highRiskStart) * 100) : 0;
  const avgScoreStart = firstMonth?.avg_risk_score ?? 0;
  const avgScoreEnd = lastMonth?.avg_risk_score ?? 0;
  const avgScoreDiff = Number((avgScoreEnd - avgScoreStart).toFixed(1));
  const isIncreasing = highRiskDiff > 0;
  const isDecreasing = highRiskDiff < 0;

  // Scatter plot data for Physical vs Financial Progress
  const scatterData = (data.progress_divergence_projects || []).map((p) => ({
    name: p.project_name,
    code: p.project_code,
    physical: p.physical_progress,
    financial: p.financial_progress,
    gap: p.progress_gap,
    risk_score: p.risk_score,
  }));

  return (
    <div id="dashboard-page" className="space-y-6 pb-12">
      {/* Top Banner / System Purpose */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-800 to-blue-950 p-6 text-white shadow-lg shadow-slate-900/10">
        <div>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-blue-500/20 px-2.5 py-0.5 text-[11px] font-bold text-blue-300 border border-blue-400/30">
              Predictive Early Warning Engine
            </span>
            <span className="text-xs text-slate-400">MoSPI & Ministry Benchmarks</span>
          </div>
          <h1 className="mt-2 text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
            Infrastructure Risk Sentinel
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-slate-300 max-w-2xl leading-relaxed">
            AI-driven predictive monitoring identifying infrastructure projects likely to experience
            cost overruns, execution delays, and critical milestone divergence.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Link
            to="/upload"
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-blue-500 transition-all"
          >
            <FileSpreadsheet className="h-4 w-4" />
            <span>Upload New Dataset</span>
          </Link>
          <button
            onClick={loadData}
            title="Refresh AI Inferences"
            className="rounded-xl border border-slate-700 bg-slate-800 p-2.5 text-slate-300 hover:bg-slate-700 hover:text-white transition-all"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Top 4 KPI Metrics */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Total Projects */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs transition-hover hover:border-slate-300">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Total Projects
            </span>
            <div className="rounded-xl bg-blue-50 p-2 text-blue-600">
              <Layers className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-3xl font-extrabold text-slate-900 tracking-tight">
              {data.total_projects}
            </span>
            <span className="text-xs font-semibold text-slate-500">Active Portfolios</span>
          </div>
          <div className="mt-2 text-[11px] text-slate-500">
            Average Portfolio Risk:{' '}
            <span className="font-bold text-slate-800">{data.avg_risk_score}/100</span>
          </div>
        </div>

        {/* High Risk Projects */}
        <div className="rounded-2xl border border-rose-200 bg-rose-50/40 p-5 shadow-xs transition-hover hover:border-rose-300">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-rose-700 uppercase tracking-wider">
              High Risk Projects
            </span>
            <div className="rounded-xl bg-rose-100 p-2 text-rose-600">
              <ShieldAlert className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-3xl font-extrabold text-rose-600 tracking-tight">
              {data.high_risk_projects}
            </span>
            <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[11px] font-bold text-rose-800">
              {Math.round((data.high_risk_projects / Math.max(1, data.total_projects)) * 100)}% of Total
            </span>
          </div>
          <div className="mt-2 text-[11px] text-rose-700">Immediate PMG intervention required</div>
        </div>

        {/* Projects With Delay Risk */}
        <div className="rounded-2xl border border-amber-200 bg-amber-50/40 p-5 shadow-xs transition-hover hover:border-amber-300">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-amber-700 uppercase tracking-wider">
              Delay Risk Alert
            </span>
            <div className="rounded-xl bg-amber-100 p-2 text-amber-600">
              <Clock className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-3xl font-extrabold text-amber-600 tracking-tight">
              {data.delay_risk_projects}
            </span>
            <span className="text-xs font-semibold text-amber-700">&gt;65% Probability</span>
          </div>
          <div className="mt-2 text-[11px] text-amber-700">Target milestone revisions detected</div>
        </div>

        {/* Projects With Cost Risk */}
        <div className="rounded-2xl border border-blue-200 bg-blue-50/40 p-5 shadow-xs transition-hover hover:border-blue-300">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-blue-700 uppercase tracking-wider">
              Cost Escalation Risk
            </span>
            <div className="rounded-xl bg-blue-100 p-2 text-blue-600">
              <Coins className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-3xl font-extrabold text-blue-700 tracking-tight">
              {data.cost_risk_projects}
            </span>
            <span className="text-xs font-semibold text-blue-700">&gt;60% Probability</span>
          </div>
          <div className="mt-2 text-[11px] text-blue-700">Budget expansion momentum flagged</div>
        </div>
      </div>

      {/* Row 2: 6-Month High Risk Project Trends Line Chart */}
      <div
        id="high-risk-project-trends-card"
        className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs"
      >
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between border-b border-slate-100 pb-4">
          <div>
            <div className="flex flex-wrap items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-100 text-rose-600">
                <TrendingUp className="h-4 w-4" />
              </div>
              <h2 className="text-lg font-bold text-slate-900">
                High Risk Project Trends
              </h2>
              {/* Trend Direction Indicator Badge */}
              <div
                id="high-risk-trend-status-badge"
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-extrabold border ${
                  isIncreasing
                    ? 'bg-rose-50 text-rose-700 border-rose-200'
                    : isDecreasing
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : 'bg-slate-50 text-slate-700 border-slate-200'
                }`}
              >
                {isIncreasing ? (
                  <>
                    <TrendingUp className="h-3.5 w-3.5 text-rose-600" />
                    <span>
                      Risk Escalating ({highRiskDiff > 0 ? `+${highRiskDiff}` : highRiskDiff} Projects / {highRiskPct > 0 ? `+${highRiskPct}%` : `${highRiskPct}%`} over 6 mos)
                    </span>
                  </>
                ) : isDecreasing ? (
                  <>
                    <TrendingDown className="h-3.5 w-3.5 text-emerald-600" />
                    <span>
                      Risk De-escalating ({highRiskDiff} Projects / {highRiskPct}% over 6 mos)
                    </span>
                  </>
                ) : (
                  <>
                    <Activity className="h-3.5 w-3.5 text-slate-600" />
                    <span>Risk Trajectory Stable</span>
                  </>
                )}
              </div>
            </div>
            <p className="mt-1.5 text-xs text-slate-500 max-w-3xl">
              Monthly portfolio trajectory over the last six months ({firstMonth?.month || 'Past 6 Months'} – {lastMonth?.month || 'Present'}) tracking high-risk volume, critical schedule delays, cost overrun signals, and composite risk index.
            </p>
          </div>

          {/* Interactive Series Toggle Buttons */}
          <div className="flex items-center gap-1 rounded-xl bg-slate-100 p-1 self-start lg:self-center shrink-0">
            <button
              id="trend-view-all-btn"
              onClick={() => setTrendMetricMode('all')}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
                trendMetricMode === 'all'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All Risk Vectors
            </button>
            <button
              id="trend-view-high-risk-btn"
              onClick={() => setTrendMetricMode('high_risk')}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
                trendMetricMode === 'high_risk'
                  ? 'bg-white text-rose-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              High Risk Volume
            </button>
            <button
              id="trend-view-avg-score-btn"
              onClick={() => setTrendMetricMode('avg_score')}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
                trendMetricMode === 'avg_score'
                  ? 'bg-white text-indigo-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Avg Risk Score
            </button>
          </div>
        </div>

        {/* Line Chart */}
        <div className="mt-6 h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={trends}
              margin={{ top: 10, right: 25, left: -10, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis
                dataKey="month"
                tick={{ fontSize: 11, fill: '#64748b', fontWeight: 600 }}
                axisLine={{ stroke: '#e2e8f0' }}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 11, fill: '#64748b' }}
                axisLine={{ stroke: '#e2e8f0' }}
                tickLine={false}
                domain={trendMetricMode === 'avg_score' ? [0, 100] : [0, 'auto']}
              />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (active && payload && payload.length) {
                    return (
                      <div className="rounded-xl bg-slate-900/95 p-3.5 text-white shadow-xl backdrop-blur-xs border border-slate-700 text-xs min-w-[210px]">
                        <div className="flex items-center justify-between border-b border-slate-700 pb-2 mb-2">
                          <span className="font-bold text-slate-200">{label}</span>
                          <span className="text-[10px] font-semibold text-slate-400">Monthly Snapshot</span>
                        </div>
                        <div className="space-y-1.5">
                          {payload.map((entry: any, index: number) => (
                            <div key={`tooltip-${index}`} className="flex items-center justify-between gap-4">
                              <span className="flex items-center gap-1.5 text-slate-300">
                                <span
                                  className="h-2 w-2 rounded-full"
                                  style={{ backgroundColor: entry.color }}
                                />
                                {entry.name}:
                              </span>
                              <span className="font-bold font-mono text-white">
                                {entry.value} {entry.name === 'Average Risk Score' ? '/ 100' : 'projects'}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Legend
                verticalAlign="top"
                align="right"
                iconType="circle"
                wrapperStyle={{ paddingBottom: 15, fontSize: 12, fontWeight: 600 }}
              />

              {(trendMetricMode === 'all' || trendMetricMode === 'high_risk') && (
                <Line
                  type="monotone"
                  dataKey="high_risk_projects"
                  name="High Risk Projects"
                  stroke="#f43f5e"
                  strokeWidth={3}
                  activeDot={{ r: 7, stroke: '#ffffff', strokeWidth: 2, fill: '#f43f5e' }}
                  dot={{ r: 4, fill: '#f43f5e', strokeWidth: 1, stroke: '#ffffff' }}
                />
              )}

              {trendMetricMode === 'all' && (
                <>
                  <Line
                    type="monotone"
                    dataKey="delay_risk_projects"
                    name="Schedule Delay Risk"
                    stroke="#f59e0b"
                    strokeWidth={2}
                    strokeDasharray="4 4"
                    dot={{ r: 3, fill: '#f59e0b' }}
                  />
                  <Line
                    type="monotone"
                    dataKey="cost_risk_projects"
                    name="Cost Escalation Risk"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    dot={{ r: 3, fill: '#3b82f6' }}
                  />
                </>
              )}

              {(trendMetricMode === 'all' || trendMetricMode === 'avg_score') && (
                <Line
                  type="monotone"
                  dataKey="avg_risk_score"
                  name="Average Risk Score"
                  stroke="#8b5cf6"
                  strokeWidth={trendMetricMode === 'avg_score' ? 3 : 2}
                  strokeDasharray={trendMetricMode === 'all' ? '2 2' : undefined}
                  dot={{ r: 4, fill: '#8b5cf6', strokeWidth: 1, stroke: '#ffffff' }}
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* 6-Month Trajectory Key Takeaways Strip */}
        <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 border-t border-slate-100 pt-4">
          <div className="rounded-xl bg-slate-50/90 p-3 border border-slate-200/60">
            <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              6-Month Net Trajectory
            </div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className={`text-lg font-extrabold ${isIncreasing ? 'text-rose-600' : isDecreasing ? 'text-emerald-600' : 'text-slate-800'}`}>
                {highRiskDiff > 0 ? `+${highRiskDiff}` : highRiskDiff} Projects
              </span>
              <span className={`text-xs font-bold ${isIncreasing ? 'text-rose-700' : isDecreasing ? 'text-emerald-700' : 'text-slate-600'}`}>
                ({highRiskPct > 0 ? `+${highRiskPct}%` : `${highRiskPct}%`})
              </span>
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">
              From {highRiskStart} ({firstMonth?.month || 'Start'}) to {highRiskEnd} ({lastMonth?.month || 'Current'})
            </div>
          </div>

          <div className="rounded-xl bg-slate-50/90 p-3 border border-slate-200/60">
            <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Portfolio Risk Index
            </div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-lg font-extrabold text-slate-900">
                {avgScoreStart} → {avgScoreEnd}
              </span>
              <span className={`text-xs font-bold ${avgScoreDiff >= 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                ({avgScoreDiff >= 0 ? `+${avgScoreDiff}` : avgScoreDiff} pts)
              </span>
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">
              Average multi-vector composite score (0-100)
            </div>
          </div>

          <div className="rounded-xl bg-slate-50/90 p-3 border border-slate-200/60">
            <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Dominant Risk Factor
            </div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-lg font-extrabold text-amber-600">
                Timeline Delays
              </span>
              <span className="text-xs font-bold text-slate-600">
                ({data.delay_risk_projects} flagged)
              </span>
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">
              Milestone revision & procurement lead time
            </div>
          </div>

          <div className="rounded-xl bg-slate-50/90 p-3 border border-slate-200/60">
            <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Portfolio Trend Status
            </div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className={`text-lg font-extrabold ${isIncreasing ? 'text-rose-600' : isDecreasing ? 'text-emerald-600' : 'text-slate-800'}`}>
                {isIncreasing ? 'Escalating' : isDecreasing ? 'Improving' : 'Stable'}
              </span>
              <span className="rounded-md bg-rose-100 px-1.5 py-0.5 text-[10px] font-extrabold text-rose-800">
                Active PMG Alert
              </span>
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">
              Immediate PMG risk mitigation recommended
            </div>
          </div>
        </div>
      </div>

      {/* Row 3: Risk Distribution Donut & Sector Risk Bar */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Risk Distribution Donut */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs lg:col-span-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900">Portfolio Risk Distribution</h2>
              <p className="text-xs text-slate-500">Classification by composite risk thresholds</p>
            </div>
          </div>

          <div className="mt-4 flex h-48 items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={riskPieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={75}
                  paddingAngle={4}
                  dataKey="value"
                >
                  {riskPieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: any, name: any) => [`${value} Projects`, name]}
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    borderRadius: '10px',
                    color: '#fff',
                    fontSize: '12px',
                    border: 'none',
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="mt-3 space-y-2 border-t border-slate-100 pt-3 text-xs">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-slate-600">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500"></span>
                Low Risk (0-30)
              </span>
              <span className="font-bold text-slate-900">{data.risk_distribution.low}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-slate-600">
                <span className="h-2.5 w-2.5 rounded-full bg-amber-500"></span>
                Medium Risk (31-60)
              </span>
              <span className="font-bold text-slate-900">{data.risk_distribution.medium}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-slate-600">
                <span className="h-2.5 w-2.5 rounded-full bg-rose-500"></span>
                High Risk (61-100)
              </span>
              <span className="font-bold text-rose-600 font-extrabold">
                {data.risk_distribution.high}
              </span>
            </div>
          </div>
        </div>

        {/* Sector Risk Analysis */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs lg:col-span-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-bold text-slate-900">Sector Risk Analysis</h2>
              <p className="text-xs text-slate-500">Average risk score and project volume across infrastructure sectors</p>
            </div>
            <Link
              to="/projects"
              className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1"
            >
              <span>View All</span>
              <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={data.sector_risk_summary}
                layout="vertical"
                margin={{ top: 5, right: 20, left: 40, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11, fill: '#64748b' }} />
                <YAxis
                  type="category"
                  dataKey="sector"
                  tick={{ fontSize: 11, fill: '#334155', fontWeight: 600 }}
                  width={110}
                />
                <Tooltip
                  formatter={(val: any) => [`${val}/100`, 'Average Risk Score']}
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    borderRadius: '10px',
                    color: '#fff',
                    fontSize: '12px',
                    border: 'none',
                  }}
                />
                <Bar
                  dataKey="avg_risk"
                  radius={[0, 6, 6, 0]}
                  fill="#3b82f6"
                  barSize={18}
                >
                  {data.sector_risk_summary.map((entry, index) => {
                    let fill = '#10b981';
                    if (entry.avg_risk >= 61) fill = '#f43f5e';
                    else if (entry.avg_risk >= 40) fill = '#f59e0b';
                    return <Cell key={`cell-${index}`} fill={fill} />;
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Row 3: Physical vs Financial Progress Divergence (Crucial Feature) */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-slate-900">Physical vs Financial Progress Divergence</h2>
              <span className="rounded-md bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800 border border-amber-200">
                Key Early Warning Metric
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Highlighting projects where financial expenditure outpaces physical completion (Progress Gap &gt; 12%)
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {data.progress_divergence_projects.slice(0, 3).map((item) => (
            <Link
              key={item.id}
              to={`/projects/${item.id}`}
              className="group rounded-xl border border-amber-200/80 bg-amber-50/30 p-4 transition-all hover:bg-white hover:border-amber-400 hover:shadow-md"
            >
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-[10px] font-bold text-slate-500 uppercase">{item.project_code}</span>
                  <h3 className="font-bold text-sm text-slate-900 line-clamp-1 group-hover:text-blue-600 transition-colors">
                    {item.project_name}
                  </h3>
                  <span className="text-xs text-slate-500">{item.sector}</span>
                </div>
                <RiskBadge level={item.risk_level} score={item.risk_score} size="sm" />
              </div>

              {/* Progress Comparison Bars */}
              <div className="mt-4 space-y-2">
                <div>
                  <div className="flex justify-between text-xs font-semibold text-slate-600 mb-1">
                    <span>Financial Disbursed:</span>
                    <span className="text-blue-600 font-bold">{item.financial_progress}%</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-slate-200 overflow-hidden">
                    <div
                      className="h-full bg-blue-600 rounded-full"
                      style={{ width: `${Math.min(100, item.financial_progress)}%` }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs font-semibold text-slate-600 mb-1">
                    <span>Physical Completed:</span>
                    <span className="text-emerald-600 font-bold">{item.physical_progress}%</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-slate-200 overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 rounded-full"
                      style={{ width: `${Math.min(100, item.physical_progress)}%` }}
                    />
                  </div>
                </div>
              </div>

              <div className="mt-3 flex items-center justify-between border-t border-amber-200/60 pt-2.5 text-xs">
                <span className="font-bold text-rose-700">
                  Divergence Gap: +{item.progress_gap}%
                </span>
                <span className="font-semibold text-blue-600 flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                  Examine Deep-Dive <ChevronRight className="h-3.5 w-3.5" />
                </span>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Row 4: Top High Risk Projects Table */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-bold text-slate-900">Priority High Risk Infrastructure Projects</h2>
            <p className="text-xs text-slate-500">Ranked by ML-computed composite risk indices</p>
          </div>
          <Link
            to="/projects?risk_level=HIGH"
            className="text-xs font-bold text-rose-600 hover:text-rose-700 flex items-center gap-1"
          >
            <span>View All High Risk</span>
            <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-bold">
                <th className="py-3 px-4">Project</th>
                <th className="py-3 px-4">Sector</th>
                <th className="py-3 px-4">Risk Score</th>
                <th className="py-3 px-4">Delay Prob</th>
                <th className="py-3 px-4">Cost Prob</th>
                <th className="py-3 px-4">Progress</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.top_high_risk_projects.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-3.5 px-4 font-semibold text-slate-900">
                    <div className="flex flex-col">
                      <span className="font-bold text-slate-900">{p.project_name}</span>
                      <span className="text-[10px] text-slate-500 font-mono">{p.project_code}</span>
                    </div>
                  </td>
                  <td className="py-3.5 px-4 text-slate-600 font-medium">{p.sector}</td>
                  <td className="py-3.5 px-4">
                    <RiskBadge
                      level={p.prediction?.risk_level || 'HIGH'}
                      score={p.prediction?.risk_score}
                      size="sm"
                    />
                  </td>
                  <td className="py-3.5 px-4 font-bold text-slate-800">
                    {p.prediction?.delay_probability}%
                  </td>
                  <td className="py-3.5 px-4 font-bold text-slate-800">
                    {p.prediction?.cost_overrun_probability}%
                  </td>
                  <td className="py-3.5 px-4">
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-2 rounded-full bg-slate-200 overflow-hidden">
                        <div
                          className="h-full bg-blue-600"
                          style={{ width: `${p.latest_monitoring?.physical_progress || 0}%` }}
                        />
                      </div>
                      <span className="font-bold text-slate-700">
                        {p.latest_monitoring?.physical_progress}%
                      </span>
                    </div>
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    <Link
                      to={`/projects/${p.id}`}
                      className="inline-flex items-center gap-1 rounded-lg bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-700 hover:bg-blue-600 hover:text-white transition-colors"
                    >
                      <span>Analyze</span>
                      <ChevronRight className="h-3 w-3" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
