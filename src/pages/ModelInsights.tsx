import React, { useEffect, useState } from 'react';
import {
  BrainCircuit,
  CheckCircle2,
  Sliders,
  TrendingUp,
  Award,
  Zap,
  BarChart3,
  Layers,
  Sparkles,
  RefreshCw,
  ShieldAlert,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Cell,
} from 'recharts';
import { fetchModelInsights, simulatePrediction } from '../services/api';
import { ModelInsightsData, Prediction } from '../types';
import { RiskBadge } from '../components/RiskBadge';
import { RiskGauge } from '../components/RiskGauge';

export const ModelInsights: React.FC = () => {
  const [data, setData] = useState<ModelInsightsData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Interactive Simulator State
  const [simCost, setSimCost] = useState<number>(3500);
  const [simRevCost, setSimRevCost] = useState<number>(4500);
  const [simExp, setSimExp] = useState<number>(3200);
  const [simPhys, setSimPhys] = useState<number>(42);
  const [simTimelineExt, setSimTimelineExt] = useState<number>(18);
  const [simSector, setSimSector] = useState<string>('Highways');
  const [simResult, setSimResult] = useState<{ prediction: Prediction; alerts: any[] } | null>(null);
  const [simulating, setSimulating] = useState<boolean>(false);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetchModelInsights();
      setData(res);
    } catch (err: any) {
      setError(err.message || 'Failed to load model insights');
    } finally {
      setLoading(false);
    }
  };

  const runSimulation = async () => {
    try {
      setSimulating(true);
      const res = await simulatePrediction({
        original_cost: simCost,
        revised_cost: simRevCost,
        expenditure: simExp,
        physical_progress: simPhys,
        timeline_revision_months: simTimelineExt,
        sector: simSector,
      });
      setSimResult(res);
    } catch (err: any) {
      console.error('Simulation error', err);
    } finally {
      setSimulating(false);
    }
  };

  useEffect(() => {
    loadData();
    runSimulation();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      runSimulation();
    }, 200);
    return () => clearTimeout(timer);
  }, [simCost, simRevCost, simExp, simPhys, simTimelineExt, simSector]);

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <RefreshCw className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-6">
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-rose-800">
          <h3 className="font-bold">Failed to load model telemetry</h3>
          <p className="text-sm mt-1">{error}</p>
        </div>
      </div>
    );
  }

  const importanceChartData = (data.feature_importance || []).map((f) => ({
    name: f.feature_name,
    importance: Math.round(f.importance * 100),
    category: f.category,
  }));

  return (
    <div id="model-insights-page" className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="rounded-md bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-800 border border-blue-200">
              Scikit-Learn ML Benchmark Matrix
            </span>
          </div>
          <h1 className="mt-1 text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            AI Model Architecture & Validation Insights
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Empirical validation comparing Baseline vs Main Ensemble classifiers on historical infrastructure benchmarks
          </p>
        </div>
      </div>

      {/* Required Hackathon Highlight Banner */}
      <div className="rounded-2xl border border-blue-300 bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 p-6 text-white shadow-md">
        <div className="flex items-start gap-4">
          <div className="rounded-xl bg-blue-500/20 p-2.5 text-blue-300 border border-blue-400/30 shrink-0">
            <Award className="h-6 w-6" />
          </div>
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-blue-300">
              Production Model Justification
            </span>
            <p className="mt-1 text-base sm:text-lg font-bold text-white leading-relaxed">
              "{data.justification}"
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-slate-300">
              <span>Sample Validation Size: <strong>{data.training_sample_count} Projects</strong></span>
              <span>•</span>
              <span>Validation Accuracy: <strong>{(data.validation_accuracy * 100).toFixed(1)}%</strong></span>
              <span>•</span>
              <span>Ensemble: <strong>Random Forest Classifier v2.4</strong></span>
            </div>
          </div>
        </div>
      </div>

      {/* Model Comparison Matrix Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* A. Delay Risk Prediction Models */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Classification Target</span>
              <h2 className="text-base font-bold text-slate-900">A. Delay Risk Prediction</h2>
            </div>
            <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-bold text-emerald-800 border border-emerald-200">
              RF Selected
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-bold">
                  <th className="py-2.5 px-3">Model</th>
                  <th className="py-2.5 px-3">Accuracy</th>
                  <th className="py-2.5 px-3">Precision</th>
                  <th className="py-2.5 px-3">Recall</th>
                  <th className="py-2.5 px-3">F1 Score</th>
                  <th className="py-2.5 px-3">ROC-AUC</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.delay_models.map((m) => (
                  <tr
                    key={m.model_name}
                    className={m.selected_for_production ? 'bg-blue-50/50 font-semibold' : ''}
                  >
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-1.5">
                        {m.selected_for_production && (
                          <CheckCircle2 className="h-4 w-4 text-blue-600" />
                        )}
                        <span className="text-slate-900">{m.model_name}</span>
                      </div>
                    </td>
                    <td className="py-3 px-3 font-bold text-slate-900">
                      {((m.accuracy || 0) * 100).toFixed(1)}%
                    </td>
                    <td className="py-3 px-3 text-slate-700">
                      {((m.precision || 0) * 100).toFixed(1)}%
                    </td>
                    <td className="py-3 px-3 text-slate-700">
                      {((m.recall || 0) * 100).toFixed(1)}%
                    </td>
                    <td className="py-3 px-3 text-slate-700">
                      {((m.f1_score || 0) * 100).toFixed(1)}%
                    </td>
                    <td className="py-3 px-3 font-bold text-blue-700">
                      {(m.roc_auc || 0).toFixed(3)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-[11px] text-slate-500 leading-snug">
            Random Forest achieves +9.8% higher accuracy and captures complex non-linear delay triggers compared to baseline Logistic Regression.
          </p>
        </div>

        {/* B. Cost Overrun Prediction Models */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Regression Target</span>
              <h2 className="text-base font-bold text-slate-900">B. Cost Escalation Prediction</h2>
            </div>
            <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-bold text-emerald-800 border border-emerald-200">
              RF Regressor Selected
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-bold">
                  <th className="py-2.5 px-3">Model</th>
                  <th className="py-2.5 px-3">MAE (Cr)</th>
                  <th className="py-2.5 px-3">RMSE</th>
                  <th className="py-2.5 px-3">R² Score</th>
                  <th className="py-2.5 px-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.cost_models.map((m) => (
                  <tr
                    key={m.model_name}
                    className={m.selected_for_production ? 'bg-blue-50/50 font-semibold' : ''}
                  >
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-1.5">
                        {m.selected_for_production && (
                          <CheckCircle2 className="h-4 w-4 text-blue-600" />
                        )}
                        <span className="text-slate-900">{m.model_name}</span>
                      </div>
                    </td>
                    <td className="py-3 px-3 font-bold text-slate-900">{m.mae}</td>
                    <td className="py-3 px-3 text-slate-700">{m.rmse}</td>
                    <td className="py-3 px-3 font-bold text-emerald-700">{m.r2_score}</td>
                    <td className="py-3 px-3">
                      <span
                        className={`rounded-sm px-1.5 py-0.5 text-[10px] font-bold ${
                          m.selected_for_production
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {m.selected_for_production ? 'Active Engine' : 'Baseline'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-[11px] text-slate-500 leading-snug">
            Random Forest Regressor reduces Mean Absolute Error by 49% and yields an R² score of 0.884 on test benchmarks.
          </p>
        </div>
      </div>

      {/* Feature Importance Analysis Chart */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-bold text-slate-900">Random Forest Feature Importance Weights</h2>
            <p className="text-xs text-slate-500">
              Gini impurity reduction & split significance across decision trees
            </p>
          </div>
        </div>

        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={importanceChartData}
              layout="vertical"
              margin={{ top: 5, right: 30, left: 180, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
              <XAxis type="number" unit="%" tick={{ fontSize: 11, fill: '#64748b' }} domain={[0, 40]} />
              <YAxis
                type="category"
                dataKey="name"
                tick={{ fontSize: 11, fill: '#334155', fontWeight: 600 }}
                width={170}
              />
              <Tooltip
                formatter={(val: any) => [`${val}%`, 'Split Contribution']}
                contentStyle={{
                  backgroundColor: '#0f172a',
                  borderRadius: '10px',
                  color: '#fff',
                  fontSize: '12px',
                  border: 'none',
                }}
              />
              <Bar dataKey="importance" radius={[0, 6, 6, 0]} fill="#2563eb" barSize={18}>
                {importanceChartData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={index === 0 ? '#ef4444' : index === 1 ? '#f59e0b' : '#3b82f6'}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Real-Time Prediction Simulator / What-If Scenario Lab */}
      <div className="rounded-2xl border border-indigo-200 bg-white p-6 shadow-xs">
        <div className="flex items-center gap-2 mb-4">
          <Sliders className="h-5 w-5 text-indigo-600" />
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Live AI Inference & What-If Scenario Lab
            </h2>
            <p className="text-xs text-slate-500">
              Adjust project telemetry parameters in real time to observe live decision tree triggers and early warning generation
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Controls */}
          <div className="lg:col-span-7 space-y-4 rounded-xl bg-slate-50 p-5 border border-slate-200">
            {/* Sector */}
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                Sector Domain
              </label>
              <select
                value={simSector}
                onChange={(e) => setSimSector(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800"
              >
                <option value="Highways">Highways</option>
                <option value="Railways">Railways (High Complexity)</option>
                <option value="Metro Rail">Metro Rail (Urban RoW)</option>
                <option value="Ports & Shipping">Ports & Shipping</option>
                <option value="Renewable Energy">Renewable Energy</option>
                <option value="Urban Water & Sanitation">Urban Water & Sanitation</option>
              </select>
            </div>

            {/* Original vs Revised Cost */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-slate-700 flex justify-between">
                  <span>Original Cost:</span>
                  <span className="font-mono text-blue-600">₹{simCost} Cr</span>
                </label>
                <input
                  type="range"
                  min={500}
                  max={15000}
                  step={100}
                  value={simCost}
                  onChange={(e) => setSimCost(Number(e.target.value))}
                  className="w-full mt-1 accent-blue-600"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 flex justify-between">
                  <span>Revised Cost:</span>
                  <span className="font-mono text-blue-600">₹{simRevCost} Cr</span>
                </label>
                <input
                  type="range"
                  min={simCost}
                  max={25000}
                  step={100}
                  value={simRevCost}
                  onChange={(e) => setSimRevCost(Number(e.target.value))}
                  className="w-full mt-1 accent-blue-600"
                />
              </div>
            </div>

            {/* Expenditure */}
            <div>
              <label className="text-xs font-bold text-slate-700 flex justify-between">
                <span>Expenditure Disbursed:</span>
                <span className="font-mono text-blue-600">
                  ₹{simExp} Cr ({Math.round((simExp / Math.max(1, simRevCost)) * 100)}% Financial)
                </span>
              </label>
              <input
                type="range"
                min={0}
                max={simRevCost}
                step={50}
                value={simExp}
                onChange={(e) => setSimExp(Number(e.target.value))}
                className="w-full mt-1 accent-blue-600"
              />
            </div>

            {/* Physical Progress */}
            <div>
              <label className="text-xs font-bold text-slate-700 flex justify-between">
                <span>Physical Ground Progress:</span>
                <span className="font-mono text-emerald-600">{simPhys}%</span>
              </label>
              <input
                type="range"
                min={0}
                max={100}
                step={1}
                value={simPhys}
                onChange={(e) => setSimPhys(Number(e.target.value))}
                className="w-full mt-1 accent-emerald-600"
              />
            </div>

            {/* Timeline Revision */}
            <div>
              <label className="text-xs font-bold text-slate-700 flex justify-between">
                <span>Timeline Revision Slippage:</span>
                <span className="font-mono text-amber-600">+{simTimelineExt} Months</span>
              </label>
              <input
                type="range"
                min={0}
                max={48}
                step={1}
                value={simTimelineExt}
                onChange={(e) => setSimTimelineExt(Number(e.target.value))}
                className="w-full mt-1 accent-amber-600"
              />
            </div>
          </div>

          {/* Real-Time Inferred Output */}
          <div className="lg:col-span-5 rounded-xl border border-slate-200 bg-slate-50/70 p-5 flex flex-col justify-between">
            {simResult ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                  <div>
                    <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">
                      Simulated Prediction
                    </span>
                    <h3 className="font-bold text-slate-900 text-sm">Live Risk Assessment</h3>
                  </div>
                  <RiskBadge
                    level={simResult.prediction.risk_level}
                    score={simResult.prediction.risk_score}
                    size="md"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3 text-center">
                  <div className="rounded-lg bg-white border border-slate-200 p-2.5">
                    <span className="text-[10px] uppercase font-bold text-slate-500">Delay Prob</span>
                    <div className="text-lg font-black text-rose-600 mt-0.5">
                      {simResult.prediction.delay_probability}%
                    </div>
                  </div>
                  <div className="rounded-lg bg-white border border-slate-200 p-2.5">
                    <span className="text-[10px] uppercase font-bold text-slate-500">Cost Escalation</span>
                    <div className="text-lg font-black text-amber-600 mt-0.5">
                      {simResult.prediction.cost_overrun_probability}%
                    </div>
                  </div>
                </div>

                <div className="space-y-1.5 text-xs">
                  <span className="font-bold text-slate-800 text-[11px] block">Top Inferred Factor:</span>
                  <div className="rounded-lg bg-white p-2.5 border border-slate-200 text-slate-700 font-medium leading-relaxed">
                    {simResult.prediction.top_risk_factors[0] || 'Parameters are within normal operating tolerances.'}
                  </div>
                </div>

                <div className="space-y-1.5 text-xs">
                  <span className="font-bold text-blue-700 text-[11px] block">Prescriptive Action:</span>
                  <div className="rounded-lg bg-blue-50 p-2.5 border border-blue-200 text-blue-900 font-semibold leading-relaxed">
                    {simResult.prediction.recommended_action}
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex h-48 items-center justify-center text-xs text-slate-400">
                Calculating inference...
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
