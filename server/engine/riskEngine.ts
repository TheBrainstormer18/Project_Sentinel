import {
  Alert,
  AlertSeverity,
  AlertType,
  FeatureContribution,
  FeatureMetrics,
  Prediction,
  Project,
  ProjectMonitoringData,
  RiskLevel,
} from '../../src/types';
import { runMLPredictions } from './mlEngine';

export interface CalculatedRiskResult {
  prediction: Prediction;
  alerts: Alert[];
}

/**
 * Reusable Hybrid Risk Engine:
 * Combines:
 * - Delay Probability -> 40%
 * - Cost Overrun Probability -> 30%
 * - Progress Gap (Normalized) -> 20%
 * - Rule-Based Risk Factors -> 10%
 *
 * Total Score = 0 to 100
 * 0 - 30   = LOW
 * 31 - 60  = MEDIUM
 * 61 - 100 = HIGH
 */
export function calculate_risk_score(
  project: { id: string; project_code: string; project_name: string; sector: string },
  monitoring: ProjectMonitoringData,
  features: FeatureMetrics
): CalculatedRiskResult {
  // 1. Run ML Ensemble Predictions
  const mlResults = runMLPredictions(monitoring, features, project.sector);
  const delayProb = mlResults.delay_probability; // 0 - 100
  const costProb = mlResults.cost_overrun_probability; // 0 - 100

  // 2. Normalize Progress Gap to 0 - 100 scale
  // Positive gap (fin > phys) increases risk; negative gap (phys > fin) indicates healthy capital velocity
  let normalizedGapScore = 0;
  if (features.progress_gap > 0) {
    // Gap of 0 -> 0 score; Gap of 40%+ -> 100 score
    normalizedGapScore = Math.min(100, Math.max(0, (features.progress_gap / 35) * 100));
  } else {
    normalizedGapScore = 0;
  }

  // 3. Rule-Based Risk Factors (0 - 100 scale)
  let ruleScore = 0;
  const ruleReasons: string[] = [];

  // Rule A: Timeline Revision
  if (features.timeline_revision_months > 18) {
    ruleScore += 40;
    ruleReasons.push(`Completion timeline has been extended by ${features.timeline_revision_months} months.`);
  } else if (features.timeline_revision_months > 6) {
    ruleScore += 20;
    ruleReasons.push(`Target completion pushed by ${features.timeline_revision_months} months.`);
  }

  // Rule B: High Cost Overrun Percentage
  if (features.cost_overrun_pct > 25) {
    ruleScore += 35;
    ruleReasons.push(`Revised project cost escalated by ${features.cost_overrun_pct}% over original sanction.`);
  } else if (features.cost_overrun_pct > 10) {
    ruleScore += 15;
    ruleReasons.push(`Project cost revised upward by ${features.cost_overrun_pct}%.`);
  }

  // Rule C: High Expenditure with Low Physical Progress
  if (features.financial_progress > 60 && monitoring.physical_progress < 40) {
    ruleScore += 25;
    ruleReasons.push(
      `Severe divergence: ${features.financial_progress}% funds disbursed against only ${monitoring.physical_progress}% physical progress.`
    );
  }

  ruleScore = Math.min(100, ruleScore);

  // 4. Calculate Final Composite Risk Score
  const delayComponent = delayProb * 0.40;
  const costComponent = costProb * 0.30;
  const gapComponent = normalizedGapScore * 0.20;
  const ruleComponent = ruleScore * 0.10;

  const rawRiskScore = delayComponent + costComponent + gapComponent + ruleComponent;
  const risk_score = Math.min(100, Math.max(0, Math.round(rawRiskScore)));

  // Determine Risk Level
  let risk_level: RiskLevel = 'LOW';
  if (risk_score >= 61) {
    risk_level = 'HIGH';
  } else if (risk_score >= 31) {
    risk_level = 'MEDIUM';
  } else {
    risk_level = 'LOW';
  }

  // 5. Generate Transparent Explainable Factors (SHAP TreeExplainer + Rule Synthesis)
  const top_risk_factors: string[] =
    mlResults.top_risk_factors && mlResults.top_risk_factors.length > 0
      ? [...mlResults.top_risk_factors]
      : [];
  const feature_contributions: FeatureContribution[] =
    mlResults.feature_contributions && mlResults.feature_contributions.length > 0
      ? [...mlResults.feature_contributions]
      : [];

  // If ML engine did not provide factors (fallback), compute rule-driven factors
  if (top_risk_factors.length === 0) {
    // Factor 1: Progress Gap explanation
    if (features.progress_gap >= 15) {
      top_risk_factors.push(
        `Physical progress is only ${monitoring.physical_progress}% while financial progress has reached ${features.financial_progress}% (+${features.progress_gap}% gap).`
      );
      feature_contributions.push({
        feature: 'Progress Gap (Disbursement vs Physical)',
        value: `+${features.progress_gap}%`,
        impact: 0.35,
        explanation: 'High capital outlay without commensurate ground work increases non-performance vulnerability.',
      });
    } else if (monitoring.physical_progress < 30) {
      top_risk_factors.push(`Early-stage execution: Physical progress is currently at ${monitoring.physical_progress}%.`);
      feature_contributions.push({
        feature: 'Physical Progress Stage',
        value: `${monitoring.physical_progress}%`,
        impact: 0.15,
        explanation: 'Initial mobilization phase with foundational work remaining.',
      });
    }

    // Factor 2: Cost Growth explanation
    if (features.cost_overrun_pct > 0) {
      top_risk_factors.push(
        `Revised cost has increased by ₹${features.cost_growth.toLocaleString()} Cr (+${features.cost_overrun_pct}% overrun).`
      );
      feature_contributions.push({
        feature: 'Cost Escalation',
        value: `+${features.cost_overrun_pct}%`,
        impact: features.cost_overrun_pct > 20 ? 0.30 : 0.18,
        explanation: 'Budgetary expansion pressures government allocation and contractor cashflow.',
      });
    }

    // Factor 3: Timeline extensions
    if (features.timeline_revision_months > 0) {
      top_risk_factors.push(
        `Completion timeline revised by +${features.timeline_revision_months} months (New target: ${monitoring.revised_completion_date}).`
      );
      feature_contributions.push({
        feature: 'Timeline Slippage',
        value: `+${features.timeline_revision_months} months`,
        impact: features.timeline_revision_months > 12 ? 0.28 : 0.16,
        explanation: 'Schedule extension compounds overhead costs and prolonged traffic/environmental disruption.',
      });
    }
  }

  // Add rule-based reasons if not already represented
  for (const r of ruleReasons) {
    if (!top_risk_factors.includes(r) && top_risk_factors.length < 5) {
      top_risk_factors.push(r);
    }
  }

  // Fallback if healthy
  if (top_risk_factors.length === 0) {
    top_risk_factors.push('Physical and financial milestones are tracking closely aligned with sanctioned schedules.');
    top_risk_factors.push('No significant budget expansion or milestone slippage observed in recent cycles.');
    feature_contributions.push({
      feature: 'Milestone Alignment',
      value: 'Synchronized',
      impact: -0.25,
      explanation: 'Healthy execution pace with on-schedule material supply and site handovers.',
    });
  }

  // 6. Generate Prescriptive Recommended Action
  let recommended_action = '';
  if (features.progress_gap >= 25) {
    recommended_action =
      'Conduct urgent financial-physical audit: verify contractor billing milestones, audit work measurement sheets, and resolve on-site execution bottlenecks before releasing subsequent tranches.';
  } else if (delayProb >= 75 && features.timeline_revision_months > 12) {
    recommended_action =
      'Convene High-Level Project Monitoring Group (PMG) review: resolve pending Right-of-Way (RoW) / statutory clearances, restructure delayed work packages, and mobilize penalty clauses for non-performing contractors.';
  } else if (costProb >= 70 || features.cost_overrun_pct > 20) {
    recommended_action =
      'Impose cost-freeze protocol: mandate third-party Value Engineering review on remaining civil packages, cap discretionary scope variations, and expedite pending utility shifting approvals.';
  } else if (risk_score >= 61) {
    recommended_action =
      'Initiate weekly milestone tracking dashboard: assign dedicated nodal officer to critical path activities and deploy standby contractor resources for lagging work fronts.';
  } else if (risk_score >= 31) {
    recommended_action =
      'Maintain standard monthly monitoring: review intermediate contractor milestones, expedite raw material supply chains, and ensure timely utility clearances.';
  } else {
    recommended_action =
      'Project on target: continue standard monthly physical verification and maintain planned fund disbursement schedule.';
  }

  const prediction: Prediction = {
    id: `pred-${project.id}-${Date.now()}`,
    project_id: project.id,
    prediction_date: new Date().toISOString().split('T')[0],
    cost_overrun_probability: costProb,
    delay_probability: delayProb,
    risk_score,
    risk_level,
    delay_model_used: mlResults.delay_model_used,
    cost_model_used: mlResults.cost_model_used,
    top_risk_factors,
    feature_contributions,
    recommended_action,
  };

  // 7. Early Warning Alerts Generation
  const alerts: Alert[] = [];
  const now = new Date().toISOString();

  // Progress Gap Alert (Yellow Warning)
  if (features.progress_gap >= 18) {
    alerts.push({
      id: `alt-gap-${project.id}`,
      project_id: project.id,
      project_code: project.project_code,
      project_name: project.project_name,
      sector: project.sector,
      alert_type: 'PROGRESS_DIVERGENCE',
      severity: features.progress_gap >= 28 ? 'HIGH' : 'MEDIUM',
      message: `Financial progress (${features.financial_progress}%) is significantly higher than physical progress (${monitoring.physical_progress}%). Progress gap: +${features.progress_gap}%.`,
      recommended_action:
        'Review expenditure efficiency, contractor performance, and site implementation bottlenecks.',
      created_at: now,
      status: 'NEW',
    });
  }

  // Cost Escalation Warning (Orange / High Warning)
  if (costProb >= 70 || features.cost_overrun_pct >= 20) {
    alerts.push({
      id: `alt-cost-${project.id}`,
      project_id: project.id,
      project_code: project.project_code,
      project_name: project.project_name,
      sector: project.sector,
      alert_type: 'COST_OVERRUN',
      severity: features.cost_overrun_pct >= 25 ? 'HIGH' : 'MEDIUM',
      message: `Significant cost escalation detected: ${features.cost_overrun_pct}% cost growth with ${costProb}% overrun probability.`,
      recommended_action:
        'Perform expenditure reconciliation, freeze non-essential scope changes, and review major EPC contract variations.',
      created_at: now,
      status: 'NEW',
    });
  }

  // Schedule Delay Alert (Red High Alert)
  if (delayProb >= 75 || features.timeline_revision_months >= 15) {
    alerts.push({
      id: `alt-delay-${project.id}`,
      project_id: project.id,
      project_code: project.project_code,
      project_name: project.project_name,
      sector: project.sector,
      alert_type: 'SCHEDULE_DELAY',
      severity: delayProb >= 85 ? 'HIGH' : 'MEDIUM',
      message: `High probability of schedule delay (${delayProb}%). Timeline revised by ${features.timeline_revision_months} months.`,
      recommended_action:
        'Review delayed milestones, conduct critical path bottleneck resolution, and establish fortnightly inter-agency review.',
      created_at: now,
      status: 'NEW',
    });
  }

  // Critical Compound Risk
  if (risk_score >= 80) {
    alerts.push({
      id: `alt-crit-${project.id}`,
      project_id: project.id,
      project_code: project.project_code,
      project_name: project.project_name,
      sector: project.sector,
      alert_type: 'CRITICAL_RISK',
      severity: 'HIGH',
      message: `Critical Composite Risk Score (${risk_score}/100): Multi-vector distress detected across timeline, expenditure, and physical execution.`,
      recommended_action:
        'Escalate to Ministry Project Monitoring Group (PMG) for immediate executive intervention.',
      created_at: now,
      status: 'NEW',
    });
  }

  return { prediction, alerts };
}
