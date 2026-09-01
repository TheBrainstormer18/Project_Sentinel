export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH';
export type AlertSeverity = 'HIGH' | 'MEDIUM' | 'LOW';
export type AlertType = 'SCHEDULE_DELAY' | 'COST_OVERRUN' | 'PROGRESS_DIVERGENCE' | 'CRITICAL_RISK';
export type AlertStatus = 'NEW' | 'REVIEWED' | 'RESOLVED';
export type DataSource = 'Official Data' | 'Imported Data' | 'Demo Data';

export interface Project {
  id: string;
  project_code: string;
  project_name: string;
  sector: string;
  ministry: string;
  implementing_agency: string;
  state: string;
  project_status: 'On-Going' | 'Delayed' | 'Under Risk' | 'Completed' | 'Tendering';
  data_source: DataSource;
  created_at: string;
  
  // Latest computed metrics
  latest_monitoring?: ProjectMonitoringData;
  features?: FeatureMetrics;
  prediction?: Prediction;
  alerts?: Alert[];
}

export interface ProjectMonitoringData {
  id: string;
  project_id: string;
  update_date: string; // YYYY-MM
  original_cost: number; // in Crores / Millions
  revised_cost: number;
  expenditure: number;
  physical_progress: number; // 0 - 100
  financial_progress: number; // 0 - 100
  original_completion_date: string; // YYYY-MM-DD
  revised_completion_date: string; // YYYY-MM-DD
}

export interface FeatureMetrics {
  cost_overrun_pct: number; // ((revised - original) / original) * 100
  financial_progress: number; // (expenditure / revised) * 100
  progress_gap: number; // financial_progress - physical_progress
  cost_growth: number; // revised_cost - original_cost
  timeline_revision_months: number; // difference in months between revised and original
  project_age_months: number;
}

export interface FeatureContribution {
  feature: string;
  value: string | number;
  impact: number; // -1 to +1 (relative risk contribution)
  explanation: string;
}

export interface Prediction {
  id: string;
  project_id: string;
  prediction_date: string;
  cost_overrun_probability: number; // 0 - 100 %
  delay_probability: number; // 0 - 100 %
  risk_score: number; // 0 - 100
  risk_level: RiskLevel;
  delay_model_used: string;
  cost_model_used: string;
  top_risk_factors: string[];
  feature_contributions: FeatureContribution[];
  recommended_action: string;
}

export interface Alert {
  id: string;
  project_id: string;
  project_code: string;
  project_name: string;
  sector: string;
  alert_type: AlertType;
  severity: AlertSeverity;
  message: string;
  recommended_action: string;
  created_at: string;
  status: AlertStatus;
}

export interface ModelMetricSummary {
  model_name: string;
  model_type: 'Baseline' | 'Main';
  target: 'Delay Risk Prediction' | 'Cost Overrun Prediction';
  accuracy?: number;
  precision?: number;
  recall?: number;
  f1_score?: number;
  roc_auc?: number;
  mae?: number;
  rmse?: number;
  r2_score?: number;
  sample_size: number;
  selected_for_production: boolean;
  notes: string;
}

export interface FeatureImportanceItem {
  feature_name: string;
  importance: number; // 0 - 1
  category: string;
}

export interface ModelInsightsData {
  delay_models: ModelMetricSummary[];
  cost_models: ModelMetricSummary[];
  feature_importance: FeatureImportanceItem[];
  selected_delay_model: string;
  selected_cost_model: string;
  justification: string;
  training_sample_count: number;
  validation_accuracy: number;
  last_trained: string;
}

export interface RiskTrendDataPoint {
  month: string; // e.g. 'Apr 2026'
  month_key: string; // e.g. '2026-04'
  high_risk_projects: number;
  medium_risk_projects: number;
  low_risk_projects: number;
  avg_risk_score: number;
  delay_risk_projects: number;
  cost_risk_projects: number;
  new_critical_alerts: number;
}

export interface DashboardSummary {
  total_projects: number;
  high_risk_projects: number;
  delay_risk_projects: number;
  cost_risk_projects: number;
  avg_risk_score: number;
  risk_distribution: {
    low: number;
    medium: number;
    high: number;
  };
  risk_trends: RiskTrendDataPoint[];
  top_high_risk_projects: Project[];
  sector_risk_summary: {
    sector: string;
    avg_risk: number;
    project_count: number;
    high_risk_count: number;
    total_cost: number;
  }[];
  progress_divergence_projects: {
    id: string;
    project_code: string;
    project_name: string;
    sector: string;
    physical_progress: number;
    financial_progress: number;
    progress_gap: number;
    risk_score: number;
    risk_level: RiskLevel;
  }[];
  recent_alerts: Alert[];
}

export type UserRole = 'admin' | 'officer';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  created_at: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user: User;
}

export interface ValidationError {
  row: number;
  field: string;
  value: any;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  total_rows: number;
  valid_rows: number;
  invalid_rows: number;
  errors: ValidationError[];
  preview: any[];
}
