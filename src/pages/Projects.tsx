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
} from 'lucide-react';
import { fetchProjects } from '../services/api';
import { Project, RiskLevel } from '../types';
import { RiskBadge } from '../components/RiskBadge';

export const Projects: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

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

  useEffect(() => {
    loadProjects();
    // update URL search params
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
          <Link
            to="/upload"
            className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-blue-700 transition-colors"
          >
            <Plus className="h-4 w-4" />
            <span>Import Projects</span>
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

        {/* Filter Dropdowns & Pills */}
        <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-100 text-xs">
          {/* Sector Filter */}
          <div className="flex items-center gap-1.5">
            <span className="font-bold text-slate-500 text-[11px] uppercase">Sector:</span>
            <select
              value={selectedSector}
              onChange={(e) => setSelectedSector(e.target.value)}
              className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 font-semibold text-slate-800 focus:outline-hidden"
            >
              {sectors.map((s) => (
                <option key={s} value={s}>
                  {s === 'ALL' ? 'All Sectors' : s}
                </option>
              ))}
            </select>
          </div>

          {/* Risk Level Filter */}
          <div className="flex items-center gap-1.5">
            <span className="font-bold text-slate-500 text-[11px] uppercase">Risk Level:</span>
            <select
              value={selectedRisk}
              onChange={(e) => setSelectedRisk(e.target.value)}
              className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 font-semibold text-slate-800 focus:outline-hidden"
            >
              <option value="ALL">All Risk Levels</option>
              <option value="HIGH">🔴 High Risk (61-100)</option>
              <option value="MEDIUM">🟡 Medium Risk (31-60)</option>
              <option value="LOW">🟢 Low Risk (0-30)</option>
            </select>
          </div>

          {/* Data Source Filter */}
          <div className="flex items-center gap-1.5">
            <span className="font-bold text-slate-500 text-[11px] uppercase">Data Source:</span>
            <select
              value={selectedDataSource}
              onChange={(e) => setSelectedDataSource(e.target.value)}
              className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 font-semibold text-slate-800 focus:outline-hidden"
            >
              <option value="ALL">All Sources</option>
              <option value="Official Data">Official Data</option>
              <option value="Imported Data">Imported Data</option>
              <option value="Demo Data">Demo Data</option>
            </select>
          </div>

          {/* Sort By */}
          <div className="flex items-center gap-1.5 ml-auto">
            <ArrowUpDown className="h-3.5 w-3.5 text-slate-400" />
            <span className="font-bold text-slate-500 text-[11px] uppercase">Sort:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 font-semibold text-slate-800 focus:outline-hidden"
            >
              <option value="risk_desc">Risk Score (High to Low)</option>
              <option value="risk_asc">Risk Score (Low to High)</option>
              <option value="cost_desc">Revised Cost (High to Low)</option>
              <option value="progress_asc">Physical Progress (Lowest First)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Projects Table View */}
      <div className="rounded-2xl border border-slate-200/80 bg-white shadow-xs overflow-hidden">
        {loading ? (
          <div className="flex h-64 items-center justify-center">
            <RefreshCw className="h-6 w-6 animate-spin text-blue-600" />
          </div>
        ) : error ? (
          <div className="p-8 text-center text-rose-600 font-semibold">{error}</div>
        ) : projects.length === 0 ? (
          <div className="p-12 text-center">
            <FolderGit2 className="mx-auto h-12 w-12 text-slate-300 mb-3" />
            <h3 className="text-base font-bold text-slate-800">No matching projects found</h3>
            <p className="text-xs text-slate-500 mt-1">Try relaxing your search terms or filter selection.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/90 text-slate-600 font-bold">
                  <th className="py-3.5 px-4">Project & Code</th>
                  <th className="py-3.5 px-4">Sector</th>
                  <th className="py-3.5 px-4">Agency / State</th>
                  <th className="py-3.5 px-4">Original Cost</th>
                  <th className="py-3.5 px-4">Revised Cost</th>
                  <th className="py-3.5 px-4">Physical vs Fin %</th>
                  <th className="py-3.5 px-4">Risk Status</th>
                  <th className="py-3.5 px-4 text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {projects.map((p) => {
                  const mon = p.latest_monitoring;
                  const feat = p.features;
                  const pred = p.prediction;
                  const costOverrun = feat?.cost_overrun_pct ?? 0;
                  const gap = feat?.progress_gap ?? 0;

                  return (
                    <tr
                      key={p.id}
                      className="hover:bg-blue-50/30 transition-colors group cursor-pointer"
                    >
                      <td className="py-4 px-4 font-semibold">
                        <Link to={`/projects/${p.id}`} className="block">
                          <div className="font-bold text-slate-900 group-hover:text-blue-600 transition-colors text-sm">
                            {p.project_name}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="font-mono text-[10px] text-slate-500 font-bold">{p.project_code}</span>
                            <span
                              className={`rounded-sm px-1.5 py-0.2 text-[9px] font-bold ${
                                p.data_source === 'Official Data'
                                  ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                  : 'bg-slate-100 text-slate-600'
                              }`}
                            >
                              {p.data_source}
                            </span>
                          </div>
                        </Link>
                      </td>
                      <td className="py-4 px-4 text-slate-700 font-medium">{p.sector}</td>
                      <td className="py-4 px-4 text-slate-600">
                        <div>{p.implementing_agency}</div>
                        <div className="text-[10px] text-slate-400">{p.state}</div>
                      </td>
                      <td className="py-4 px-4 text-slate-700 font-mono">
                        ₹{(mon?.original_cost || 0).toLocaleString()} Cr
                      </td>
                      <td className="py-4 px-4 font-mono">
                        <span className="font-bold text-slate-900">
                          ₹{(mon?.revised_cost || 0).toLocaleString()} Cr
                        </span>
                        {costOverrun > 0 && (
                          <div className="text-[10px] font-bold text-rose-600">
                            +{costOverrun}%
                          </div>
                        )}
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
    </div>
  );
};
