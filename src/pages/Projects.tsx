import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Search,
  Filter,
  ArrowUpDown,
  ChevronRight,
  FolderGit2,
  RefreshCw,
  Plus,
  TrendingUp,
  Sparkles,
  FolderPlus,
  X,
  UserCheck,
  Building2,
  Calendar,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import { fetchProjects, createProject, fetchUsers } from '../services/api';
import { Project, RiskLevel, UserProfile } from '../types';
import { RiskBadge } from '../components/RiskBadge';
import { useAuth } from '../context/AuthContext';

export const Projects: React.FC = () => {
  const { isAdmin } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Modal State for Project Creation
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [officers, setOfficers] = useState<UserProfile[]>([]);
  const [modalSubmitting, setModalSubmitting] = useState<boolean>(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [modalSuccess, setModalSuccess] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    project_name: '',
    project_code: '',
    sector: 'Highways',
    ministry: '',
    implementing_agency: '',
    state: '',
    original_cost: '',
    revised_cost: '',
    expenditure: '',
    physical_progress: '',
    original_completion_date: '',
    revised_completion_date: '',
    assigned_to: '',
  });

  const initialSearch = searchParams.get('search') || '';
  const initialSector = searchParams.get('sector') || 'ALL';
  const initialRisk = searchParams.get('risk_level') || 'ALL';
  const initialDataSource = searchParams.get('data_source') || 'ALL';
  const initialSort = searchParams.get('sort_by') || 'risk_desc';

  const [searchTerm, setSearchTerm] = useState(initialSearch);
  const [selectedSector, setSelectedSector] = useState(initialSector);
  const [selectedRisk, setSelectedRisk] = useState(initialRisk);
  const [selectedDataSource, setSelectedDataSource] = useState(initialDataSource);
  const [sortBy, setSortBy] = useState(initialSort);

  const loadProjects = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchProjects({
        search: searchTerm,
        sector: selectedSector,
        risk_level: selectedRisk,
        data_source: selectedDataSource,
        sort_by: sortBy,
      });
      setProjects(data);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch projects');
    } finally {
      setLoading(false);
    }
  };

  const loadOfficers = async () => {
    try {
      const allUsers = await fetchUsers();
      setOfficers(allUsers.filter((u) => u.role === 'officer'));
    } catch {
      // Fallback
    }
  };

  useEffect(() => {
    loadProjects();
    const newParams: Record<string, string> = {};
    if (searchTerm) newParams.search = searchTerm;
    if (selectedSector !== 'ALL') newParams.sector = selectedSector;
    if (selectedRisk !== 'ALL') newParams.risk_level = selectedRisk;
    if (selectedDataSource !== 'ALL') newParams.data_source = selectedDataSource;
    if (sortBy !== 'risk_desc') newParams.sort_by = sortBy;
    setSearchParams(newParams, { replace: true });
  }, [selectedSector, selectedRisk, selectedDataSource, sortBy]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadProjects();
  };

  const handleOpenModal = () => {
    setIsModalOpen(true);
    setModalError(null);
    setModalSuccess(null);
    loadOfficers();
  };

  const handleModalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError(null);
    setModalSuccess(null);

    if (!formData.project_name.trim() || !formData.project_code.trim()) {
      setModalError('Project name and project code are required.');
      return;
    }

    setModalSubmitting(true);
    try {
      await createProject({
        project_name: formData.project_name.trim(),
        project_code: formData.project_code.trim(),
        sector: formData.sector,
        ministry: formData.ministry.trim() || 'Ministry of Infrastructure',
        implementing_agency: formData.implementing_agency.trim() || 'Nodal Implementing Agency',
        state: formData.state.trim() || 'Multi-State',
        original_cost: Number(formData.original_cost) || 100,
        revised_cost: Number(formData.revised_cost) || Number(formData.original_cost) || 100,
        expenditure: Number(formData.expenditure) || 0,
        physical_progress: Number(formData.physical_progress) || 0,
        original_completion_date: formData.original_completion_date || '2026-12-31',
        revised_completion_date: formData.revised_completion_date || '2027-06-30',
        assigned_to: formData.assigned_to || null,
      });

      setModalSuccess('Project successfully registered and persisted in Supabase!');
      setTimeout(() => {
        setIsModalOpen(false);
        loadProjects();
      }, 1200);
    } catch (err: any) {
      setModalError(err.message || 'Failed to create project in Supabase');
    } finally {
      setModalSubmitting(false);
    }
  };

  const sectors = [
    'ALL',
    'Highways',
    'Railways',
    'Metro Rail',
    'Renewable Energy',
    'Ports & Shipping',
    'Urban Water & Sanitation',
  ];

  return (
    <div id="projects-page" className="space-y-6 pb-12">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Infrastructure Project Explorer
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Real-time project inventory with ML-driven delay probabilities and cost escalation indexes
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Admin Project Creation Button */}
          {isAdmin && (
            <button
              onClick={handleOpenModal}
              className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-2 text-xs font-bold text-white shadow-xs hover:bg-indigo-700 transition-colors"
            >
              <FolderPlus className="h-4 w-4" />
              <span>Add Project</span>
            </button>
          )}

          <Link
            to="/upload"
            className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-3.5 py-2 text-xs font-bold text-white shadow-xs hover:bg-blue-700 transition-colors"
          >
            <Plus className="h-4 w-4" />
            <span>Import Data</span>
          </Link>
          <button
            onClick={loadProjects}
            className="rounded-xl border border-slate-200 bg-white p-2 text-slate-600 hover:bg-slate-50 transition-colors"
            title="Refresh"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Filter and Search Bar Card */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-5 shadow-xs space-y-4">
        <form onSubmit={handleSearchSubmit} className="flex flex-col md:flex-row gap-3">
          {/* Search Bar */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by project name, code, ministry, agency, state..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50/60 pl-9 pr-4 py-2 text-xs text-slate-800 focus:border-blue-500 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-100"
            />
          </div>

          <button
            type="submit"
            className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white hover:bg-slate-800 transition-colors"
          >
            Search
          </button>
        </form>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-100">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-600">
            <Filter className="h-3.5 w-3.5 text-slate-400" />
            <span>Filters:</span>
          </div>

          {/* Sector Filter */}
          <div className="flex items-center gap-1">
            <span className="text-[11px] text-slate-500">Sector:</span>
            <select
              value={selectedSector}
              onChange={(e) => setSelectedSector(e.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 focus:border-blue-500 focus:outline-hidden"
            >
              {sectors.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          {/* Risk Level Filter */}
          <div className="flex items-center gap-1">
            <span className="text-[11px] text-slate-500">Risk Level:</span>
            <select
              value={selectedRisk}
              onChange={(e) => setSelectedRisk(e.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 focus:border-blue-500 focus:outline-hidden"
            >
              <option value="ALL">All Risk Levels</option>
              <option value="HIGH">High Risk Only</option>
              <option value="MEDIUM">Medium Risk Only</option>
              <option value="LOW">Low Risk Only</option>
            </select>
          </div>

          {/* Sort By */}
          <div className="flex items-center gap-1 ml-auto">
            <ArrowUpDown className="h-3.5 w-3.5 text-slate-400" />
            <span className="text-[11px] text-slate-500">Sort:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 focus:border-blue-500 focus:outline-hidden"
            >
              <option value="risk_desc">Risk Score: High to Low</option>
              <option value="risk_asc">Risk Score: Low to High</option>
              <option value="cost_desc">Cost: Highest First</option>
              <option value="progress_asc">Progress: Lowest First</option>
            </select>
          </div>
        </div>
      </div>

      {/* Projects Table / Cards */}
      <div className="rounded-2xl border border-slate-200/80 bg-white shadow-xs overflow-hidden">
        {loading ? (
          <div className="py-20 text-center text-slate-400">
            <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-blue-600 border-t-transparent mb-2" />
            <p className="text-xs">Loading infrastructure telemetry from PostgreSQL...</p>
          </div>
        ) : error ? (
          <div className="p-8 text-center text-rose-600 text-xs">
            <p>{error}</p>
            <button
              onClick={loadProjects}
              className="mt-3 inline-flex items-center gap-1 text-blue-600 font-bold underline"
            >
              Retry
            </button>
          </div>
        ) : projects.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-xs">
            <p>No infrastructure projects found matching the active filters.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  <th className="py-3.5 px-4 sm:px-6">Project Metadata</th>
                  <th className="py-3.5 px-4">Sector & State</th>
                  <th className="py-3.5 px-4">Cost Telemetry (Cr)</th>
                  <th className="py-3.5 px-4">Physical vs Fin</th>
                  <th className="py-3.5 px-4">AI Risk Score</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                {projects.map((p) => {
                  const mon = p.latest_monitoring;
                  const pred = p.prediction;
                  const feat = p.features;
                  const gap = feat?.progress_gap || 0;

                  return (
                    <tr key={p.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-4 px-4 sm:px-6">
                        <div className="space-y-1">
                          <div className="font-bold text-slate-900 line-clamp-1 flex items-center gap-2">
                            <span>{p.project_name}</span>
                            {p.is_demo && (
                              <span className="rounded-md bg-amber-50 border border-amber-200 px-1.5 py-0.2 text-[9px] font-extrabold text-amber-700">
                                DEMO
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-[11px] text-slate-500">
                            <span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded text-slate-600">
                              {p.project_code}
                            </span>
                            <span>•</span>
                            <span>{p.implementing_agency}</span>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <div className="space-y-0.5">
                          <span className="font-semibold text-slate-800">{p.sector}</span>
                          <div className="text-[11px] text-slate-500">{p.state}</div>
                        </div>
                      </td>
                      <td className="py-4 px-4 font-mono">
                        <div className="space-y-0.5">
                          <div className="font-bold text-slate-900">
                            ₹{mon?.revised_cost?.toLocaleString() || 'N/A'} Cr
                          </div>
                          {feat && feat.cost_overrun_pct > 0 && (
                            <div className="text-[10px] font-bold text-rose-600">
                              +{feat.cost_overrun_pct}% Overrun
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <div className="space-y-1 w-32">
                          <div className="flex justify-between text-[11px] font-bold">
                            <span className="text-emerald-700">Phys: {mon?.physical_progress}%</span>
                            <span className="text-blue-700">Fin: {feat?.financial_progress}%</span>
                          </div>
                          <div className="h-1.5 w-full rounded-full bg-slate-200 overflow-hidden flex">
                            <div
                              className="bg-emerald-500 h-full"
                              style={{ width: `${mon?.physical_progress || 0}%` }}
                            />
                          </div>
                          {gap >= 12 && (
                            <div className="text-[10px] font-bold text-amber-700">
                              Gap: +{gap}%
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <RiskBadge
                          level={pred?.risk_level || 'LOW'}
                          score={pred?.risk_score}
                          size="md"
                        />
                      </td>
                      <td className="py-4 px-4 text-right">
                        <Link
                          to={`/projects/${p.id}`}
                          className="inline-flex items-center gap-1 rounded-xl bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-blue-600 hover:text-white transition-all shadow-2xs"
                        >
                          <span>Deep-Dive</span>
                          <ChevronRight className="h-3.5 w-3.5" />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Admin Add Project Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="relative w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl border border-slate-200 my-8">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="h-9 w-9 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600 font-black">
                  +
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900">Add Infrastructure Project</h2>
                  <p className="text-xs text-slate-500">Register and assign a new infrastructure project to an officer</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {modalError && (
              <div className="mb-4 flex items-start gap-2 rounded-xl bg-rose-50 border border-rose-200 p-3 text-xs text-rose-700">
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-500 mt-0.5" />
                <div>{modalError}</div>
              </div>
            )}

            {modalSuccess && (
              <div className="mb-4 flex items-start gap-2 rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-xs text-emerald-700">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500 mt-0.5" />
                <div>{modalSuccess}</div>
              </div>
            )}

            <form onSubmit={handleModalSubmit} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Project Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.project_name}
                    onChange={(e) => setFormData({ ...formData, project_name: e.target.value })}
                    placeholder="e.g. Pune Metro Line 3 Hinjawadi Corridor"
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-900 placeholder-slate-400 focus:border-indigo-500 focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Project Code *</label>
                  <input
                    type="text"
                    required
                    value={formData.project_code}
                    onChange={(e) => setFormData({ ...formData, project_code: e.target.value })}
                    placeholder="e.g. PMRDA-METRO-L3"
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-900 placeholder-slate-400 focus:border-indigo-500 focus:outline-hidden"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Sector</label>
                  <select
                    value={formData.sector}
                    onChange={(e) => setFormData({ ...formData, sector: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-900 focus:border-indigo-500 focus:outline-hidden"
                  >
                    <option value="Highways">Highways</option>
                    <option value="Railways">Railways</option>
                    <option value="Metro Rail">Metro Rail</option>
                    <option value="Renewable Energy">Renewable Energy</option>
                    <option value="Ports & Shipping">Ports & Shipping</option>
                    <option value="Urban Water & Sanitation">Urban Water & Sanitation</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Ministry</label>
                  <input
                    type="text"
                    value={formData.ministry}
                    onChange={(e) => setFormData({ ...formData, ministry: e.target.value })}
                    placeholder="Ministry of Housing & Urban Affairs"
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-900 placeholder-slate-400 focus:border-indigo-500 focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">State</label>
                  <input
                    type="text"
                    value={formData.state}
                    onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                    placeholder="Maharashtra"
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-900 placeholder-slate-400 focus:border-indigo-500 focus:outline-hidden"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Implementing Agency</label>
                  <input
                    type="text"
                    value={formData.implementing_agency}
                    onChange={(e) => setFormData({ ...formData, implementing_agency: e.target.value })}
                    placeholder="e.g. PMRDA"
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-900 placeholder-slate-400 focus:border-indigo-500 focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Assign to Officer</label>
                  <select
                    value={formData.assigned_to}
                    onChange={(e) => setFormData({ ...formData, assigned_to: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-900 focus:border-indigo-500 focus:outline-hidden"
                  >
                    <option value="">Unassigned (Admin only view)</option>
                    {officers.map((off) => (
                      <option key={off.id} value={off.id}>
                        {off.name} ({off.email})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-100">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Original Cost (₹ Cr)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={formData.original_cost}
                    onChange={(e) => setFormData({ ...formData, original_cost: e.target.value })}
                    placeholder="2500"
                    className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-slate-900"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Revised Cost (₹ Cr)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={formData.revised_cost}
                    onChange={(e) => setFormData({ ...formData, revised_cost: e.target.value })}
                    placeholder="2800"
                    className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-slate-900"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Expenditure (₹ Cr)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={formData.expenditure}
                    onChange={(e) => setFormData({ ...formData, expenditure: e.target.value })}
                    placeholder="1200"
                    className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-slate-900"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Physical Progress (%)</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="100"
                    value={formData.physical_progress}
                    onChange={(e) => setFormData({ ...formData, physical_progress: e.target.value })}
                    placeholder="35"
                    className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-slate-900"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Original Target Date</label>
                  <input
                    type="date"
                    value={formData.original_completion_date}
                    onChange={(e) => setFormData({ ...formData, original_completion_date: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-900 focus:border-indigo-500 focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Revised Target Date</label>
                  <input
                    type="date"
                    value={formData.revised_completion_date}
                    onChange={(e) => setFormData({ ...formData, revised_completion_date: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-900 focus:border-indigo-500 focus:outline-hidden"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={modalSubmitting}
                  className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white hover:bg-indigo-700 shadow-xs disabled:opacity-50 flex items-center gap-1.5"
                >
                  {modalSubmitting ? 'Saving to Supabase...' : 'Save & Calculate Risk'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
