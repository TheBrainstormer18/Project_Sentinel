import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  UploadCloud,
  FileSpreadsheet,
  CheckCircle2,
  AlertOctagon,
  AlertTriangle,
  FileText,
  Download,
  ArrowRight,
  Database,
  Sparkles,
  RefreshCw,
} from 'lucide-react';
import { uploadProjectData } from '../services/api';
import { ValidationResult } from '../types';

export const DataUpload: React.FC = () => {
  const navigate = useNavigate();
  const [file, setFile] = useState<File | null>(null);
  const [dataSource, setDataSource] = useState<string>('Imported Data');
  const [validating, setValidating] = useState<boolean>(false);
  const [importing, setImporting] = useState<boolean>(false);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successResult, setSuccessResult] = useState<any | null>(null);

  const sampleCSVTemplate = `project_code,project_name,sector,ministry,implementing_agency,state,original_cost,revised_cost,expenditure,physical_progress,financial_progress,original_completion_date,revised_completion_date
NHAI-NH48-CORR,Six-Lane Highway Expansion (Surat-Mumbai NH-48),Highways,Ministry of Road Transport and Highways,NHAI,Gujarat,4200,5350,3900,45.0,72.8,2025-12-31,2027-03-31
IR-DEDICATED-EDFC,Eastern Dedicated Freight Corridor (Sonnagar-Dankuni),Railways,Ministry of Railways,DFCCIL,West Bengal,12500,16800,14100,62.0,83.9,2024-12-31,2026-11-30
DMRC-PH4-AEROCITY,Delhi Metro Phase 4 (Aerocity to Tughlakabad Line),Metro Rail,Ministry of Housing and Urban Affairs,DMRC,Delhi-NCR,9500,10200,6800,52.0,66.6,2026-06-30,2027-08-31
SECI-SOLAR-PARK,750 MW Pavagada Solar Grid Interconnection,Renewable Energy,Ministry of New and Renewable Energy,SECI,Karnataka,3100,3180,2950,88.0,92.7,2026-05-31,2026-07-31
JJM-WATER-GRID,Rural Piped Drinking Water Pipeline Mission (Phase 3),Urban Water & Sanitation,Ministry of Jal Shakti,National Jal Jeevan Mission,Rajasthan,1850,2300,1650,38.0,71.7,2025-09-30,2026-12-31`;

  const handleDownloadSample = () => {
    const blob = new Blob([sampleCSVTemplate], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'project_sentinel_sample_data.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selected = e.target.files[0];
      setFile(selected);
      setValidationResult(null);
      setErrorMsg(null);
      setSuccessResult(null);
      // Automatically run validation preview
      validateFile(selected, dataSource);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const selected = e.dataTransfer.files[0];
      setFile(selected);
      setValidationResult(null);
      setErrorMsg(null);
      setSuccessResult(null);
      validateFile(selected, dataSource);
    }
  };

  const validateFile = async (targetFile: File, source: string) => {
    try {
      setValidating(true);
      setErrorMsg(null);
      const res = await uploadProjectData({ file: targetFile }, false, source);
      setValidationResult(res.validation);
    } catch (err: any) {
      setErrorMsg(err.message || 'Validation failed');
    } finally {
      setValidating(false);
    }
  };

  const handleLoadSampleQuick = async () => {
    try {
      setValidating(true);
      setErrorMsg(null);
      const res = await uploadProjectData({ csv_text: sampleCSVTemplate }, false, 'Official Data');
      setValidationResult(res.validation);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to load sample dataset');
    } finally {
      setValidating(false);
    }
  };

  const handleConfirmImport = async () => {
    try {
      setImporting(true);
      setErrorMsg(null);
      const res = await uploadProjectData(
        file ? { file } : { csv_text: sampleCSVTemplate },
        true,
        dataSource
      );
      setSuccessResult(res);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to import projects to database');
    } finally {
      setImporting(false);
    }
  };

  return (
    <div id="data-upload-page" className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="rounded-md bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-800 border border-blue-200">
              Data Ingestion & Integrity Engine
            </span>
          </div>
          <h1 className="mt-1 text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Data Upload & Ingestion Pipeline
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Ingest official PAIMANA/MoSPI spreadsheets with strict schema verification and automatic model recalibration
          </p>
        </div>

        <button
          onClick={handleDownloadSample}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors"
        >
          <Download className="h-4 w-4" />
          <span>Download CSV Template</span>
        </button>
      </div>

      {/* Success Confirmation Banner */}
      {successResult && (
        <div className="rounded-2xl border border-emerald-300 bg-emerald-50 p-6 shadow-sm animate-in fade-in duration-300">
          <div className="flex items-start gap-4">
            <div className="rounded-xl bg-emerald-600 p-2.5 text-white">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-emerald-950">
                Data Successfully Ingested & Models Recalibrated!
              </h3>
              <p className="mt-1 text-xs text-emerald-800 leading-relaxed">
                {successResult.message}
              </p>
              <div className="mt-4 flex items-center gap-3">
                <button
                  onClick={() => navigate('/projects')}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-700 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-800 transition-colors"
                >
                  <span>Explore Ingested Projects</span>
                  <ArrowRight className="h-4 w-4" />
                </button>
                <button
                  onClick={() => navigate('/alerts')}
                  className="rounded-xl border border-emerald-300 bg-white px-4 py-2 text-xs font-bold text-emerald-800 hover:bg-emerald-100"
                >
                  View Generated Early Warnings
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Upload & Configuration Card */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs space-y-6">
        {/* Step 1: Metadata & Data Source Selection */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div>
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Step 1: Provenance Tagging
            </span>
            <h2 className="text-sm font-bold text-slate-900">Select Project Data Source</h2>
          </div>

          <div className="flex items-center gap-2 text-xs">
            {['Official Data', 'Imported Data', 'Demo Data'].map((src) => (
              <button
                key={src}
                type="button"
                onClick={() => setDataSource(src)}
                className={`rounded-xl px-3.5 py-1.5 font-bold transition-all border ${
                  dataSource === src
                    ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                {src}
              </button>
            ))}
          </div>
        </div>

        {/* Step 2: File Dropzone */}
        <div>
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50/60 p-8 text-center transition-all hover:border-blue-500 hover:bg-blue-50/20"
          >
            <div className="rounded-2xl bg-blue-100 p-3 text-blue-600 mb-3">
              <UploadCloud className="h-8 w-8" />
            </div>

            <h3 className="text-sm font-bold text-slate-900">
              Drag & Drop your infrastructure CSV or XLSX spreadsheet here
            </h3>
            <p className="text-xs text-slate-500 mt-1 max-w-md">
              Supports MoSPI monitoring formats, NHAI project sheets, and custom ministry records
            </p>

            <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
              <label className="cursor-pointer rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white hover:bg-slate-800 transition-colors">
                <span>Browse Files</span>
                <input
                  type="file"
                  accept=".csv, .xlsx, .xls"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </label>

              <button
                type="button"
                onClick={handleLoadSampleQuick}
                className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors"
              >
                Load Pre-Configured MoSPI Benchmark (5 Projects)
              </button>
            </div>

            {file && (
              <div className="mt-3 inline-flex items-center gap-2 rounded-lg bg-blue-50 px-3 py-1 text-xs font-bold text-blue-800">
                <FileSpreadsheet className="h-4 w-4" />
                <span>Selected: {file.name} ({(file.size / 1024).toFixed(1)} KB)</span>
              </div>
            )}
          </div>
        </div>

        {/* Error notification */}
        {errorMsg && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs font-bold text-rose-800 flex items-center gap-2">
            <AlertOctagon className="h-4 w-4 text-rose-600 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}
      </div>

      {/* Step 3 & 4: Validation Engine & Preview Table */}
      {validating ? (
        <div className="rounded-2xl border border-slate-200/80 bg-white p-12 text-center shadow-xs">
          <RefreshCw className="mx-auto h-8 w-8 animate-spin text-blue-600 mb-3" />
          <p className="text-sm font-bold text-slate-800">
            Running 6-Point Data Quality & Integrity Checks...
          </p>
          <p className="text-xs text-slate-500 mt-1">
            Checking missing columns, date formats, negative cost values, and physical progress bounds (&lt;=100%)
          </p>
        </div>
      ) : validationResult ? (
        <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span
                  className={`rounded-md px-2.5 py-0.5 text-xs font-bold ${
                    validationResult.valid
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-amber-100 text-amber-800'
                  }`}
                >
                  {validationResult.valid ? '✓ Schema Verification Passed' : '⚠ Validation Warnings Found'}
                </span>
              </div>
              <h2 className="text-base font-bold text-slate-900 mt-1">
                Data Ingestion Preview ({validationResult.valid_rows} Valid Rows of {validationResult.total_rows})
              </h2>
            </div>

            <button
              onClick={handleConfirmImport}
              disabled={importing || validationResult.valid_rows === 0}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-2.5 text-xs font-bold text-white shadow-md shadow-blue-500/20 hover:from-blue-500 hover:to-indigo-500 transition-all disabled:opacity-50"
            >
              <Database className="h-4 w-4" />
              <span>{importing ? 'Importing & Recalculating...' : 'Confirm & Commit to Database'}</span>
            </button>
          </div>

          {/* Validation Errors List if any */}
          {validationResult.errors.length > 0 && (
            <div className="rounded-xl border border-rose-200 bg-rose-50/60 p-4">
              <span className="text-xs font-bold text-rose-800 uppercase tracking-wider block mb-2">
                Row-Level Validation Exceptions ({validationResult.errors.length}):
              </span>
              <ul className="space-y-1 text-xs text-rose-700">
                {validationResult.errors.slice(0, 5).map((e, idx) => (
                  <li key={idx} className="flex items-center gap-1.5">
                    <span className="font-bold">Row {e.row}:</span>
                    <span>Field [{e.field}] — {e.message}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Preview Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-bold">
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Project Code</th>
                  <th className="py-2.5 px-3">Project Name</th>
                  <th className="py-2.5 px-3">Sector</th>
                  <th className="py-2.5 px-3">Original Cost</th>
                  <th className="py-2.5 px-3">Revised Cost</th>
                  <th className="py-2.5 px-3">Phys %</th>
                  <th className="py-2.5 px-3">Target Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {validationResult.preview.map((row, i) => (
                  <tr key={i} className="hover:bg-slate-50 transition-colors">
                    <td className="py-2.5 px-3">
                      <span
                        className={`rounded-sm px-2 py-0.5 text-[10px] font-bold ${
                          row.status === 'VALID'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {row.status}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 font-mono font-bold text-slate-900">
                      {row.project_code}
                    </td>
                    <td className="py-2.5 px-3 font-semibold text-slate-800">
                      {row.project_name}
                    </td>
                    <td className="py-2.5 px-3 text-slate-600">{row.sector}</td>
                    <td className="py-2.5 px-3 font-mono">₹{row.original_cost} Cr</td>
                    <td className="py-2.5 px-3 font-mono font-bold">₹{row.revised_cost} Cr</td>
                    <td className="py-2.5 px-3 font-bold text-emerald-700">{row.physical_progress}%</td>
                    <td className="py-2.5 px-3 font-mono text-slate-600">{row.revised_completion_date}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  );
};
