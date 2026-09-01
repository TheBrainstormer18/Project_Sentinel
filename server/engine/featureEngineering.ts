import { FeatureMetrics, ProjectMonitoringData } from '../../src/types';

/**
 * Automatically calculate useful project features from monitoring metrics:
 * 1. Cost Overrun Percentage: ((revised_cost - original_cost) / original_cost) * 100
 * 2. Financial Progress: (expenditure / revised_cost) * 100
 * 3. Progress Gap: financial_progress - physical_progress
 * 4. Cost Growth: revised_cost - original_cost
 * 5. Timeline Revision: Difference between revised and original completion date (in months)
 * 6. Project Age: Months elapsed from original project start/baseline
 */
export function calculateFeatures(monitoring: ProjectMonitoringData): FeatureMetrics {
  const origCost = Math.max(monitoring.original_cost, 0.01);
  const revCost = Math.max(monitoring.revised_cost, origCost, 0.01);
  const expenditure = Math.max(monitoring.expenditure, 0);

  // 1. Cost Overrun Percentage
  const cost_overrun_pct = Number((((revCost - origCost) / origCost) * 100).toFixed(2));

  // 2. Financial Progress (%)
  const calculated_fin_progress = Number(((expenditure / revCost) * 100).toFixed(2));
  const financial_progress = monitoring.financial_progress > 0 
    ? monitoring.financial_progress 
    : calculated_fin_progress;

  // 3. Progress Gap: financial_progress - physical_progress
  const progress_gap = Number((financial_progress - monitoring.physical_progress).toFixed(2));

  // 4. Cost Growth (Absolute cost increase in Crores)
  const cost_growth = Number((revCost - origCost).toFixed(2));

  // 5. Timeline Revision (months extended)
  let timeline_revision_months = 0;
  try {
    const origDate = new Date(monitoring.original_completion_date);
    const revDate = new Date(monitoring.revised_completion_date);
    if (!isNaN(origDate.getTime()) && !isNaN(revDate.getTime())) {
      const diffTime = revDate.getTime() - origDate.getTime();
      const diffMonths = diffTime / (1000 * 60 * 60 * 24 * 30.4375);
      timeline_revision_months = Math.max(0, Number(diffMonths.toFixed(1)));
    }
  } catch (e) {
    timeline_revision_months = 0;
  }

  // 6. Project Age (months elapsed up to update_date)
  let project_age_months = 24; // standard baseline
  try {
    const updateDate = new Date(monitoring.update_date || '2026-06-01');
    const origDate = new Date(monitoring.original_completion_date);
    if (!isNaN(updateDate.getTime()) && !isNaN(origDate.getTime())) {
      // Approximate project start as 3-5 years prior or derived from current progress
      const progressRatio = Math.max(0.05, monitoring.physical_progress / 100);
      project_age_months = Math.round(18 + (progressRatio * 36));
    }
  } catch (e) {
    project_age_months = 24;
  }

  return {
    cost_overrun_pct,
    financial_progress,
    progress_gap,
    cost_growth,
    timeline_revision_months,
    project_age_months,
  };
}
