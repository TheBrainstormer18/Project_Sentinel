import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { Project, ProjectMonitoringData, ValidationError, ValidationResult } from '../../src/types';

export const REQUIRED_COLUMNS = [
  'project_code',
  'project_name',
  'sector',
  'ministry',
  'implementing_agency',
  'state',
  'original_cost',
  'revised_cost',
  'expenditure',
  'physical_progress',
  'original_completion_date',
  'revised_completion_date',
];

export interface ParsedRowData {
  project_code: string;
  project_name: string;
  sector: string;
  ministry: string;
  implementing_agency: string;
  state: string;
  project_status?: string;
  update_date?: string;
  original_cost: number;
  revised_cost: number;
  expenditure: number;
  physical_progress: number;
  financial_progress?: number;
  original_completion_date: string;
  revised_completion_date: string;
  data_source?: string;
}

/**
 * Validates parsed raw rows from CSV/XLSX
 */
export function validateProjectRecords(rawRows: Record<string, any>[]): ValidationResult {
  const errors: ValidationError[] = [];
  const validRows: ParsedRowData[] = [];
  const preview: any[] = [];

  rawRows.forEach((row, index) => {
    const rowNum = index + 2; // account for header (1-indexed)
    const rowErrors: string[] = [];

    // 1. Missing required field checks
    const project_code = String(row.project_code || row['Project Code'] || '').trim();
    const project_name = String(row.project_name || row['Project Name'] || '').trim();
    const sector = String(row.sector || row['Sector'] || 'Infrastructure').trim();
    const ministry = String(row.ministry || row['Ministry'] || 'Ministry of Infrastructure').trim();
    const implementing_agency = String(row.implementing_agency || row['Implementing Agency'] || 'Nodal Agency').trim();
    const state = String(row.state || row['State'] || 'Multi-State').trim();

    if (!project_code) {
      rowErrors.push('Missing project_code');
      errors.push({ row: rowNum, field: 'project_code', value: project_code, message: 'Project code is required' });
    }
    if (!project_name) {
      rowErrors.push('Missing project_name');
      errors.push({ row: rowNum, field: 'project_name', value: project_name, message: 'Project name is required' });
    }

    // 2. Numeric and Cost Validation (Negative checks, NaN checks)
    const origCostRaw = row.original_cost ?? row['Original Cost (Cr)'] ?? row['Original Cost'] ?? 0;
    const revCostRaw = row.revised_cost ?? row['Revised Cost (Cr)'] ?? row['Revised Cost'] ?? origCostRaw;
    const expRaw = row.expenditure ?? row['Expenditure (Cr)'] ?? row['Expenditure'] ?? 0;

    const original_cost = Number(origCostRaw);
    const revised_cost = Number(revCostRaw);
    const expenditure = Number(expRaw);

    if (isNaN(original_cost) || original_cost <= 0) {
      rowErrors.push('Invalid/Negative original_cost');
      errors.push({ row: rowNum, field: 'original_cost', value: origCostRaw, message: 'Original cost must be a positive number' });
    }

    if (isNaN(revised_cost) || revised_cost < 0) {
      rowErrors.push('Invalid/Negative revised_cost');
      errors.push({ row: rowNum, field: 'revised_cost', value: revCostRaw, message: 'Revised cost cannot be negative' });
    }

    if (isNaN(expenditure) || expenditure < 0) {
      rowErrors.push('Invalid/Negative expenditure');
      errors.push({ row: rowNum, field: 'expenditure', value: expRaw, message: 'Expenditure cannot be negative' });
    }

    // 3. Physical Progress checks (0 - 100%)
    const physRaw = row.physical_progress ?? row['Physical Progress (%)'] ?? row['Physical Progress'] ?? 0;
    const physical_progress = Number(physRaw);

    if (isNaN(physical_progress) || physical_progress < 0 || physical_progress > 100) {
      rowErrors.push('Physical progress must be between 0 and 100%');
      errors.push({ row: rowNum, field: 'physical_progress', value: physRaw, message: 'Physical progress must be between 0 and 100%' });
    }

    // 4. Financial Progress checks
    const finRaw = row.financial_progress ?? row['Financial Progress (%)'] ?? row['Financial Progress'];
    let financial_progress = finRaw !== undefined && finRaw !== '' ? Number(finRaw) : 0;
    if (isNaN(financial_progress) || financial_progress < 0) {
      financial_progress = revised_cost > 0 ? Number(((expenditure / revised_cost) * 100).toFixed(2)) : 0;
    }
    if (financial_progress > 150) {
      rowErrors.push('Financial progress exceeds reasonable threshold (>150%)');
      errors.push({ row: rowNum, field: 'financial_progress', value: finRaw, message: 'Financial progress exceeds 150%' });
    }

    // 5. Date Validation
    const origDateStr = String(row.original_completion_date || row['Original Completion Date'] || '2026-12-31').trim();
    const revDateStr = String(row.revised_completion_date || row['Revised Completion Date'] || origDateStr).trim();
    const updateDateStr = String(row.update_date || row['Update Date'] || new Date().toISOString().slice(0, 7)).trim();

    const origDate = new Date(origDateStr);
    const revDate = new Date(revDateStr);

    if (isNaN(origDate.getTime())) {
      rowErrors.push('Invalid original_completion_date');
      errors.push({ row: rowNum, field: 'original_completion_date', value: origDateStr, message: 'Invalid date format (use YYYY-MM-DD)' });
    }
    if (isNaN(revDate.getTime())) {
      rowErrors.push('Invalid revised_completion_date');
      errors.push({ row: rowNum, field: 'revised_completion_date', value: revDateStr, message: 'Invalid date format (use YYYY-MM-DD)' });
    }

    const isValid = rowErrors.length === 0;

    const parsedItem: ParsedRowData = {
      project_code: project_code || `PRJ-${index + 100}`,
      project_name: project_name || `Project ${index + 1}`,
      sector,
      ministry,
      implementing_agency,
      state,
      project_status: (row.project_status || row['Status'] || 'On-Going') as any,
      update_date: updateDateStr,
      original_cost: isNaN(original_cost) ? 100 : original_cost,
      revised_cost: isNaN(revised_cost) ? original_cost : revised_cost,
      expenditure: isNaN(expenditure) ? 0 : expenditure,
      physical_progress: isNaN(physical_progress) ? 0 : physical_progress,
      financial_progress,
      original_completion_date: origDateStr,
      revised_completion_date: revDateStr,
      data_source: row.data_source || 'Imported Data',
    };

    if (isValid) {
      validRows.push(parsedItem);
    }

    if (preview.length < 15) {
      preview.push({
        row: rowNum,
        ...parsedItem,
        status: isValid ? 'VALID' : 'INVALID',
        validationErrors: rowErrors,
      });
    }
  });

  return {
    valid: errors.length === 0,
    total_rows: rawRows.length,
    valid_rows: validRows.length,
    invalid_rows: rawRows.length - validRows.length,
    errors,
    preview,
  };
}

/**
 * Parse CSV text
 */
export function parseCSVData(csvText: string): Record<string, any>[] {
  const result = Papa.parse(csvText, {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: true,
  });
  return (result.data as Record<string, any>[]) || [];
}

/**
 * Parse Excel buffer
 */
export function parseExcelBuffer(buffer: Buffer | ArrayBuffer): Record<string, any>[] {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) return [];
  const worksheet = workbook.Sheets[firstSheetName];
  return XLSX.utils.sheet_to_json(worksheet);
}
