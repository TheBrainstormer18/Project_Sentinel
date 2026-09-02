-- ==============================================================================
-- PROJECT SENTINEL AI - SUPABASE POSTGRESQL SCHEMA & INITIAL DEMO SEED
-- ==============================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. PROFILES TABLE (Linked to Supabase auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'officer')) DEFAULT 'officer',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Profiles Policies:
-- Any authenticated user can view profiles (to allow project assignment to officers)
DROP POLICY IF EXISTS "Allow authenticated users to read profiles" ON public.profiles;
CREATE POLICY "Allow authenticated users to read profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (true);

-- Users can update their own name, but NEVER their own role
DROP POLICY IF EXISTS "Allow users to update own name only" ON public.profiles;
CREATE POLICY "Allow users to update own name only"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id AND
    role = (SELECT p.role FROM public.profiles p WHERE p.id = auth.uid())
  );

-- Trigger to create a profile automatically when a user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    'officer' -- All new registrations strictly default to officer
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 3. PROJECTS TABLE
CREATE TABLE IF NOT EXISTS public.projects (
  id TEXT PRIMARY KEY,
  project_code TEXT UNIQUE NOT NULL,
  project_name TEXT NOT NULL,
  sector TEXT NOT NULL,
  ministry TEXT NOT NULL,
  implementing_agency TEXT NOT NULL,
  state TEXT NOT NULL,
  project_status TEXT NOT NULL DEFAULT 'On-Going',
  data_source TEXT NOT NULL DEFAULT 'MoSPI Benchmark',
  assigned_to UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  is_demo BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. PROJECT MONITORING TABLE
CREATE TABLE IF NOT EXISTS public.project_monitoring (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  update_date TEXT NOT NULL,
  original_cost NUMERIC NOT NULL,
  revised_cost NUMERIC NOT NULL,
  expenditure NUMERIC NOT NULL,
  physical_progress NUMERIC NOT NULL,
  financial_progress NUMERIC NOT NULL,
  original_completion_date TEXT NOT NULL,
  revised_completion_date TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 5. PROJECT PREDICTIONS TABLE
CREATE TABLE IF NOT EXISTS public.project_predictions (
  project_id TEXT PRIMARY KEY REFERENCES public.projects(id) ON DELETE CASCADE,
  risk_score NUMERIC NOT NULL,
  risk_level TEXT NOT NULL CHECK (risk_level IN ('LOW', 'MEDIUM', 'HIGH')),
  delay_probability NUMERIC NOT NULL,
  cost_overrun_probability NUMERIC NOT NULL,
  top_risk_factors JSONB NOT NULL DEFAULT '[]'::jsonb,
  recommended_action TEXT NOT NULL,
  cost_overrun_pct NUMERIC NOT NULL DEFAULT 0,
  cost_growth NUMERIC NOT NULL DEFAULT 0,
  progress_gap NUMERIC NOT NULL DEFAULT 0,
  timeline_revision_months NUMERIC NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 6. ALERTS TABLE
CREATE TABLE IF NOT EXISTS public.alerts (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  project_name TEXT NOT NULL,
  project_code TEXT NOT NULL,
  sector TEXT NOT NULL,
  alert_type TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('LOW', 'MEDIUM', 'HIGH')),
  message TEXT NOT NULL,
  recommended_action TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('NEW', 'REVIEWED', 'RESOLVED')) DEFAULT 'NEW',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- INDEXES
CREATE INDEX IF NOT EXISTS idx_projects_assigned ON public.projects(assigned_to);
CREATE INDEX IF NOT EXISTS idx_projects_is_demo ON public.projects(is_demo);
CREATE INDEX IF NOT EXISTS idx_monitoring_project_id ON public.project_monitoring(project_id);
CREATE INDEX IF NOT EXISTS idx_predictions_risk_level ON public.project_predictions(risk_level);
CREATE INDEX IF NOT EXISTS idx_alerts_status ON public.alerts(status);

-- ==============================================================================
-- CONTROLLED SEED DATA FOR 10 DEMO PROJECTS (is_demo = true)
-- ==============================================================================

-- Projects Seed
INSERT INTO public.projects (id, project_code, project_name, sector, ministry, implementing_agency, state, project_status, data_source, is_demo, created_at)
VALUES ('prj-001', 'NHAI-DME-PKG4', 'Delhi-Mumbai Expressway Spur (Package IV Vadodara-Kim)', 'Highways', 'Ministry of Road Transport and Highways', 'National Highways Authority of India (NHAI)', 'Gujarat', 'Under Risk', 'Official Data', true, '2023-01-15')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.project_monitoring (id, project_id, update_date, original_cost, revised_cost, expenditure, physical_progress, financial_progress, original_completion_date, revised_completion_date)
VALUES ('mon-prj-001-1', 'prj-001', '2025-10-01', 3250, 3500, 2100, 35, 60, '2025-06-30', '2026-03-31')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.project_monitoring (id, project_id, update_date, original_cost, revised_cost, expenditure, physical_progress, financial_progress, original_completion_date, revised_completion_date)
VALUES ('mon-prj-001-2', 'prj-001', '2025-12-01', 3250, 3820, 2450, 38, 64.1, '2025-06-30', '2026-09-30')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.project_monitoring (id, project_id, update_date, original_cost, revised_cost, expenditure, physical_progress, financial_progress, original_completion_date, revised_completion_date)
VALUES ('mon-prj-001-3', 'prj-001', '2026-03-01', 3250, 4160, 2980, 41.5, 71.6, '2025-06-30', '2027-01-15')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.project_monitoring (id, project_id, update_date, original_cost, revised_cost, expenditure, physical_progress, financial_progress, original_completion_date, revised_completion_date)
VALUES ('mon-prj-001-4', 'prj-001', '2026-06-01', 3250, 4280, 3250, 42, 76, '2025-06-30', '2027-04-30')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.project_predictions (project_id, risk_score, risk_level, delay_probability, cost_overrun_probability, top_risk_factors, recommended_action, cost_overrun_pct, cost_growth, progress_gap, timeline_revision_months)
VALUES ('prj-001', 74, 'HIGH', 66.7, 68.7, '["Physical progress is only 42% while financial progress has reached 76% (+34% gap).","Revised cost has increased by ₹1,030 Cr (+31.69% overrun).","Completion timeline revised by +22 months (New target: 2027-04-30).","Completion timeline has been extended by 22 months.","Revised project cost escalated by 31.69% over original sanction."]'::jsonb, 'Conduct urgent financial-physical audit: verify contractor billing milestones, audit work measurement sheets, and resolve on-site execution bottlenecks before releasing subsequent tranches.', 31.69, 1030, 34, 22)
ON CONFLICT (project_id) DO NOTHING;
INSERT INTO public.projects (id, project_code, project_name, sector, ministry, implementing_agency, state, project_status, data_source, is_demo, created_at)
VALUES ('prj-002', 'DFCCIL-WDFC-JNPT', 'Western Dedicated Freight Corridor (Vaitarna-JNPT Section)', 'Railways', 'Ministry of Railways', 'Dedicated Freight Corridor Corporation of India (DFCCIL)', 'Maharashtra', 'Delayed', 'Official Data', true, '2021-08-10')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.project_monitoring (id, project_id, update_date, original_cost, revised_cost, expenditure, physical_progress, financial_progress, original_completion_date, revised_completion_date)
VALUES ('mon-prj-002-1', 'prj-002', '2025-09-01', 8400, 10200, 7600, 54, 74.5, '2024-12-31', '2026-06-30')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.project_monitoring (id, project_id, update_date, original_cost, revised_cost, expenditure, physical_progress, financial_progress, original_completion_date, revised_completion_date)
VALUES ('mon-prj-002-2', 'prj-002', '2026-06-01', 8400, 11450, 9150, 58.2, 79.9, '2024-12-31', '2027-08-31')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.project_predictions (project_id, risk_score, risk_level, delay_probability, cost_overrun_probability, top_risk_factors, recommended_action, cost_overrun_pct, cost_growth, progress_gap, timeline_revision_months)
VALUES ('prj-002', 71, 'HIGH', 68.9, 76.8, '["Physical progress is only 58.2% while financial progress has reached 79.9% (+21.7% gap).","Revised cost has increased by ₹3,050 Cr (+36.31% overrun).","Completion timeline revised by +32 months (New target: 2027-08-31).","Completion timeline has been extended by 32 months.","Revised project cost escalated by 36.31% over original sanction."]'::jsonb, 'Impose cost-freeze protocol: mandate third-party Value Engineering review on remaining civil packages, cap discretionary scope variations, and expedite pending utility shifting approvals.', 36.31, 3050, 21.7, 32)
ON CONFLICT (project_id) DO NOTHING;
INSERT INTO public.projects (id, project_code, project_name, sector, ministry, implementing_agency, state, project_status, data_source, is_demo, created_at)
VALUES ('prj-003', 'BMRCL-PH2A-ORR', 'Bengaluru Metro Phase 2A (Silk Board to KR Puram Outer Ring Road)', 'Metro Rail', 'Ministry of Housing and Urban Affairs', 'Bangalore Metro Rail Corporation Ltd (BMRCL)', 'Karnataka', 'Under Risk', 'Official Data', true, '2022-04-12')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.project_monitoring (id, project_id, update_date, original_cost, revised_cost, expenditure, physical_progress, financial_progress, original_completion_date, revised_completion_date)
VALUES ('mon-prj-003-1', 'prj-003', '2026-01-01', 5600, 6150, 3850, 49, 62.6, '2025-12-31', '2026-12-31')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.project_monitoring (id, project_id, update_date, original_cost, revised_cost, expenditure, physical_progress, financial_progress, original_completion_date, revised_completion_date)
VALUES ('mon-prj-003-2', 'prj-003', '2026-06-01', 5600, 6480, 4420, 51.5, 68.2, '2025-12-31', '2027-06-30')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.project_predictions (project_id, risk_score, risk_level, delay_probability, cost_overrun_probability, top_risk_factors, recommended_action, cost_overrun_pct, cost_growth, progress_gap, timeline_revision_months)
VALUES ('prj-003', 56, 'MEDIUM', 61.1, 61.8, '["Physical progress is only 51.5% while financial progress has reached 68.2% (+16.7% gap).","Revised cost has increased by ₹880 Cr (+15.71% overrun).","Completion timeline revised by +17.9 months (New target: 2027-06-30).","Target completion pushed by 17.9 months.","Project cost revised upward by 15.71%."]'::jsonb, 'Maintain standard monthly monitoring: review intermediate contractor milestones, expedite raw material supply chains, and ensure timely utility clearances.', 15.71, 880, 16.7, 17.9)
ON CONFLICT (project_id) DO NOTHING;
INSERT INTO public.projects (id, project_code, project_name, sector, ministry, implementing_agency, state, project_status, data_source, is_demo, created_at)
VALUES ('prj-004', 'NHSRCL-MAHSR-PKG-C4', 'Mumbai-Ahmedabad High Speed Rail (Surat-Bilimora Viaduct)', 'Highways', 'Ministry of Railways', 'National High Speed Rail Corporation (NHSRCL)', 'Gujarat', 'On-Going', 'Official Data', true, '2021-11-20')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.project_monitoring (id, project_id, update_date, original_cost, revised_cost, expenditure, physical_progress, financial_progress, original_completion_date, revised_completion_date)
VALUES ('mon-prj-004-1', 'prj-004', '2026-06-01', 15400, 15850, 11200, 74, 70.6, '2026-12-31', '2027-03-31')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.project_predictions (project_id, risk_score, risk_level, delay_probability, cost_overrun_probability, top_risk_factors, recommended_action, cost_overrun_pct, cost_growth, progress_gap, timeline_revision_months)
VALUES ('prj-004', 26, 'LOW', 35.9, 37.2, '["Revised cost has increased by ₹450 Cr (+2.92% overrun).","Completion timeline revised by +3 months (New target: 2027-03-31)."]'::jsonb, 'Project on target: continue standard monthly physical verification and maintain planned fund disbursement schedule.', 2.92, 450, -3.4, 3)
ON CONFLICT (project_id) DO NOTHING;
INSERT INTO public.projects (id, project_code, project_name, sector, ministry, implementing_agency, state, project_status, data_source, is_demo, created_at)
VALUES ('prj-005', 'SECI-REWA-SOLAR-II', 'Rewa Ultra Mega Solar Park Expansion Phase II (500 MW Grid)', 'Renewable Energy', 'Ministry of New and Renewable Energy', 'Solar Energy Corporation of India (SECI)', 'Madhya Pradesh', 'On-Going', 'Official Data', true, '2024-02-15')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.project_monitoring (id, project_id, update_date, original_cost, revised_cost, expenditure, physical_progress, financial_progress, original_completion_date, revised_completion_date)
VALUES ('mon-prj-005-1', 'prj-005', '2026-06-01', 2100, 2150, 1720, 81, 80, '2026-09-30', '2026-10-31')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.project_predictions (project_id, risk_score, risk_level, delay_probability, cost_overrun_probability, top_risk_factors, recommended_action, cost_overrun_pct, cost_growth, progress_gap, timeline_revision_months)
VALUES ('prj-005', 23, 'LOW', 29.6, 37.2, '["Revised cost has increased by ₹50 Cr (+2.38% overrun).","Completion timeline revised by +1 months (New target: 2026-10-31)."]'::jsonb, 'Project on target: continue standard monthly physical verification and maintain planned fund disbursement schedule.', 2.38, 50, -1, 1)
ON CONFLICT (project_id) DO NOTHING;
INSERT INTO public.projects (id, project_code, project_name, sector, ministry, implementing_agency, state, project_status, data_source, is_demo, created_at)
VALUES ('prj-006', 'JNPA-VADHAVAN-PORT', 'Vadhavan Deepwater All-Weather Mega Port (Phase 1 Offshore Reclamation)', 'Ports & Shipping', 'Ministry of Ports, Shipping and Waterways', 'Vadhavan Port Project Ltd / JNPA', 'Maharashtra', 'Under Risk', 'Official Data', true, '2024-05-01')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.project_monitoring (id, project_id, update_date, original_cost, revised_cost, expenditure, physical_progress, financial_progress, original_completion_date, revised_completion_date)
VALUES ('mon-prj-006-1', 'prj-006', '2026-06-01', 18500, 22800, 8900, 22, 39, '2028-12-31', '2030-06-30')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.project_predictions (project_id, risk_score, risk_level, delay_probability, cost_overrun_probability, top_risk_factors, recommended_action, cost_overrun_pct, cost_growth, progress_gap, timeline_revision_months)
VALUES ('prj-006', 57, 'MEDIUM', 62.4, 62.5, '["Physical progress is only 22% while financial progress has reached 39% (+17% gap).","Revised cost has increased by ₹4,300 Cr (+23.24% overrun).","Completion timeline revised by +17.9 months (New target: 2030-06-30).","Target completion pushed by 17.9 months.","Project cost revised upward by 23.24%."]'::jsonb, 'Impose cost-freeze protocol: mandate third-party Value Engineering review on remaining civil packages, cap discretionary scope variations, and expedite pending utility shifting approvals.', 23.24, 4300, 17, 17.9)
ON CONFLICT (project_id) DO NOTHING;
INSERT INTO public.projects (id, project_code, project_name, sector, ministry, implementing_agency, state, project_status, data_source, is_demo, created_at)
VALUES ('prj-007', 'NCRTC-RRTS-DEL-MEE', 'Delhi-Ghaziabad-Meerut Regional Rapid Transit System (RRTS Urban)', 'Metro Rail', 'Ministry of Housing and Urban Affairs', 'National Capital Region Transport Corporation (NCRTC)', 'Delhi-NCR', 'On-Going', 'Official Data', true, '2020-03-10')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.project_monitoring (id, project_id, update_date, original_cost, revised_cost, expenditure, physical_progress, financial_progress, original_completion_date, revised_completion_date)
VALUES ('mon-prj-007-1', 'prj-007', '2026-06-01', 30274, 31200, 27800, 89.5, 89.1, '2025-06-30', '2026-08-31')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.project_predictions (project_id, risk_score, risk_level, delay_probability, cost_overrun_probability, top_risk_factors, recommended_action, cost_overrun_pct, cost_growth, progress_gap, timeline_revision_months)
VALUES ('prj-007', 33, 'MEDIUM', 41.1, 47.2, '["Revised cost has increased by ₹926 Cr (+3.06% overrun).","Completion timeline revised by +14 months (New target: 2026-08-31).","Target completion pushed by 14 months."]'::jsonb, 'Maintain standard monthly monitoring: review intermediate contractor milestones, expedite raw material supply chains, and ensure timely utility clearances.', 3.06, 926, -0.4, 14)
ON CONFLICT (project_id) DO NOTHING;
INSERT INTO public.projects (id, project_code, project_name, sector, ministry, implementing_agency, state, project_status, data_source, is_demo, created_at)
VALUES ('prj-008', 'JJM-URBAN-UP-WTR', 'Jal Jeevan Mission Urban Water Grid Supply Pipeline (Varanasi-Prayagraj)', 'Urban Water & Sanitation', 'Ministry of Jal Shakti', 'State Water and Sanitation Mission (SWSM UP)', 'Uttar Pradesh', 'Under Risk', 'Official Data', true, '2023-08-20')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.project_monitoring (id, project_id, update_date, original_cost, revised_cost, expenditure, physical_progress, financial_progress, original_completion_date, revised_completion_date)
VALUES ('mon-prj-008-1', 'prj-008', '2026-06-01', 1450, 1890, 1350, 44, 71.4, '2025-10-31', '2027-02-28')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.project_predictions (project_id, risk_score, risk_level, delay_probability, cost_overrun_probability, top_risk_factors, recommended_action, cost_overrun_pct, cost_growth, progress_gap, timeline_revision_months)
VALUES ('prj-008', 65, 'HIGH', 61.7, 64.8, '["Physical progress is only 44% while financial progress has reached 71.4% (+27.4% gap).","Revised cost has increased by ₹440 Cr (+30.34% overrun).","Completion timeline revised by +15.9 months (New target: 2027-02-28).","Target completion pushed by 15.9 months.","Revised project cost escalated by 30.34% over original sanction."]'::jsonb, 'Conduct urgent financial-physical audit: verify contractor billing milestones, audit work measurement sheets, and resolve on-site execution bottlenecks before releasing subsequent tranches.', 30.34, 440, 27.4, 15.9)
ON CONFLICT (project_id) DO NOTHING;
INSERT INTO public.projects (id, project_code, project_name, sector, ministry, implementing_agency, state, project_status, data_source, is_demo, created_at)
VALUES ('prj-009', 'KRCL-USBRL-CHENAB', 'Udhampur-Srinagar-Baramulla Rail Link (Chenab Bridge Connection)', 'Railways', 'Ministry of Railways', 'Konkan Railway / Northern Railway', 'Jammu & Kashmir', 'On-Going', 'Official Data', true, '2019-06-01')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.project_monitoring (id, project_id, update_date, original_cost, revised_cost, expenditure, physical_progress, financial_progress, original_completion_date, revised_completion_date)
VALUES ('mon-prj-009-1', 'prj-009', '2026-06-01', 21650, 37980, 35100, 93, 92.4, '2022-12-31', '2026-10-31')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.project_predictions (project_id, risk_score, risk_level, delay_probability, cost_overrun_probability, top_risk_factors, recommended_action, cost_overrun_pct, cost_growth, progress_gap, timeline_revision_months)
VALUES ('prj-009', 48, 'MEDIUM', 50.5, 66.2, '["Revised cost has increased by ₹16,330 Cr (+75.43% overrun).","Completion timeline revised by +46 months (New target: 2026-10-31).","Completion timeline has been extended by 46 months.","Revised project cost escalated by 75.43% over original sanction."]'::jsonb, 'Impose cost-freeze protocol: mandate third-party Value Engineering review on remaining civil packages, cap discretionary scope variations, and expedite pending utility shifting approvals.', 75.43, 16330, -0.6, 46)
ON CONFLICT (project_id) DO NOTHING;
INSERT INTO public.projects (id, project_code, project_name, sector, ministry, implementing_agency, state, project_status, data_source, is_demo, created_at)
VALUES ('prj-010', 'NHAI-ZOJILA-TUNNEL', 'Zojila All-Weather Strategic Tunnel (NH-1 Baltal-Minamarg)', 'Highways', 'Ministry of Road Transport and Highways', 'NHIDCL', 'Ladakh', 'Under Risk', 'Official Data', true, '2020-10-15')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.project_monitoring (id, project_id, update_date, original_cost, revised_cost, expenditure, physical_progress, financial_progress, original_completion_date, revised_completion_date)
VALUES ('mon-prj-010-1', 'prj-010', '2026-06-01', 4600, 6800, 4950, 48, 72.8, '2026-12-31', '2028-11-30')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.project_predictions (project_id, risk_score, risk_level, delay_probability, cost_overrun_probability, top_risk_factors, recommended_action, cost_overrun_pct, cost_growth, progress_gap, timeline_revision_months)
VALUES ('prj-010', 68, 'HIGH', 60, 74.5, '["Physical progress is only 48% while financial progress has reached 72.8% (+24.8% gap).","Revised cost has increased by ₹2,200 Cr (+47.83% overrun).","Completion timeline revised by +23 months (New target: 2028-11-30).","Completion timeline has been extended by 23 months.","Revised project cost escalated by 47.83% over original sanction."]'::jsonb, 'Impose cost-freeze protocol: mandate third-party Value Engineering review on remaining civil packages, cap discretionary scope variations, and expedite pending utility shifting approvals.', 47.83, 2200, 24.8, 23)
ON CONFLICT (project_id) DO NOTHING;

-- Alerts Seed
INSERT INTO public.alerts (id, project_id, project_name, project_code, sector, alert_type, severity, message, recommended_action, status, created_at)
VALUES ('alt-cost-prj-009', 'prj-009', 'Udhampur-Srinagar-Baramulla Rail Link (Chenab Bridge Connection)', 'KRCL-USBRL-CHENAB', 'Railways', 'COST_OVERRUN', 'HIGH', 'Significant cost escalation detected: 75.43% cost growth with 66.2% overrun probability.', 'Perform expenditure reconciliation, freeze non-essential scope changes, and review major EPC contract variations.', 'NEW', '2026-09-02T18:58:10.174Z')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.alerts (id, project_id, project_name, project_code, sector, alert_type, severity, message, recommended_action, status, created_at)
VALUES ('alt-delay-prj-009', 'prj-009', 'Udhampur-Srinagar-Baramulla Rail Link (Chenab Bridge Connection)', 'KRCL-USBRL-CHENAB', 'Railways', 'SCHEDULE_DELAY', 'MEDIUM', 'High probability of schedule delay (50.5%). Timeline revised by 46 months.', 'Review delayed milestones, conduct critical path bottleneck resolution, and establish fortnightly inter-agency review.', 'NEW', '2026-09-02T18:58:10.174Z')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.alerts (id, project_id, project_name, project_code, sector, alert_type, severity, message, recommended_action, status, created_at)
VALUES ('alt-gap-prj-010', 'prj-010', 'Zojila All-Weather Strategic Tunnel (NH-1 Baltal-Minamarg)', 'NHAI-ZOJILA-TUNNEL', 'Highways', 'PROGRESS_DIVERGENCE', 'MEDIUM', 'Financial progress (72.8%) is significantly higher than physical progress (48%). Progress gap: +24.8%.', 'Review expenditure efficiency, contractor performance, and site implementation bottlenecks.', 'NEW', '2026-09-02T18:58:10.174Z')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.alerts (id, project_id, project_name, project_code, sector, alert_type, severity, message, recommended_action, status, created_at)
VALUES ('alt-cost-prj-010', 'prj-010', 'Zojila All-Weather Strategic Tunnel (NH-1 Baltal-Minamarg)', 'NHAI-ZOJILA-TUNNEL', 'Highways', 'COST_OVERRUN', 'HIGH', 'Significant cost escalation detected: 47.83% cost growth with 74.5% overrun probability.', 'Perform expenditure reconciliation, freeze non-essential scope changes, and review major EPC contract variations.', 'NEW', '2026-09-02T18:58:10.174Z')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.alerts (id, project_id, project_name, project_code, sector, alert_type, severity, message, recommended_action, status, created_at)
VALUES ('alt-delay-prj-010', 'prj-010', 'Zojila All-Weather Strategic Tunnel (NH-1 Baltal-Minamarg)', 'NHAI-ZOJILA-TUNNEL', 'Highways', 'SCHEDULE_DELAY', 'MEDIUM', 'High probability of schedule delay (60%). Timeline revised by 23 months.', 'Review delayed milestones, conduct critical path bottleneck resolution, and establish fortnightly inter-agency review.', 'NEW', '2026-09-02T18:58:10.174Z')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.alerts (id, project_id, project_name, project_code, sector, alert_type, severity, message, recommended_action, status, created_at)
VALUES ('alt-gap-prj-001', 'prj-001', 'Delhi-Mumbai Expressway Spur (Package IV Vadodara-Kim)', 'NHAI-DME-PKG4', 'Highways', 'PROGRESS_DIVERGENCE', 'HIGH', 'Financial progress (76%) is significantly higher than physical progress (42%). Progress gap: +34%.', 'Review expenditure efficiency, contractor performance, and site implementation bottlenecks.', 'NEW', '2026-09-02T18:58:10.173Z')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.alerts (id, project_id, project_name, project_code, sector, alert_type, severity, message, recommended_action, status, created_at)
VALUES ('alt-cost-prj-001', 'prj-001', 'Delhi-Mumbai Expressway Spur (Package IV Vadodara-Kim)', 'NHAI-DME-PKG4', 'Highways', 'COST_OVERRUN', 'HIGH', 'Significant cost escalation detected: 31.69% cost growth with 68.7% overrun probability.', 'Perform expenditure reconciliation, freeze non-essential scope changes, and review major EPC contract variations.', 'NEW', '2026-09-02T18:58:10.173Z')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.alerts (id, project_id, project_name, project_code, sector, alert_type, severity, message, recommended_action, status, created_at)
VALUES ('alt-delay-prj-001', 'prj-001', 'Delhi-Mumbai Expressway Spur (Package IV Vadodara-Kim)', 'NHAI-DME-PKG4', 'Highways', 'SCHEDULE_DELAY', 'MEDIUM', 'High probability of schedule delay (66.7%). Timeline revised by 22 months.', 'Review delayed milestones, conduct critical path bottleneck resolution, and establish fortnightly inter-agency review.', 'NEW', '2026-09-02T18:58:10.173Z')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.alerts (id, project_id, project_name, project_code, sector, alert_type, severity, message, recommended_action, status, created_at)
VALUES ('alt-gap-prj-002', 'prj-002', 'Western Dedicated Freight Corridor (Vaitarna-JNPT Section)', 'DFCCIL-WDFC-JNPT', 'Railways', 'PROGRESS_DIVERGENCE', 'MEDIUM', 'Financial progress (79.9%) is significantly higher than physical progress (58.2%). Progress gap: +21.7%.', 'Review expenditure efficiency, contractor performance, and site implementation bottlenecks.', 'NEW', '2026-09-02T18:58:10.173Z')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.alerts (id, project_id, project_name, project_code, sector, alert_type, severity, message, recommended_action, status, created_at)
VALUES ('alt-cost-prj-002', 'prj-002', 'Western Dedicated Freight Corridor (Vaitarna-JNPT Section)', 'DFCCIL-WDFC-JNPT', 'Railways', 'COST_OVERRUN', 'HIGH', 'Significant cost escalation detected: 36.31% cost growth with 76.8% overrun probability.', 'Perform expenditure reconciliation, freeze non-essential scope changes, and review major EPC contract variations.', 'NEW', '2026-09-02T18:58:10.173Z')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.alerts (id, project_id, project_name, project_code, sector, alert_type, severity, message, recommended_action, status, created_at)
VALUES ('alt-delay-prj-002', 'prj-002', 'Western Dedicated Freight Corridor (Vaitarna-JNPT Section)', 'DFCCIL-WDFC-JNPT', 'Railways', 'SCHEDULE_DELAY', 'MEDIUM', 'High probability of schedule delay (68.9%). Timeline revised by 32 months.', 'Review delayed milestones, conduct critical path bottleneck resolution, and establish fortnightly inter-agency review.', 'NEW', '2026-09-02T18:58:10.173Z')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.alerts (id, project_id, project_name, project_code, sector, alert_type, severity, message, recommended_action, status, created_at)
VALUES ('alt-delay-prj-003', 'prj-003', 'Bengaluru Metro Phase 2A (Silk Board to KR Puram Outer Ring Road)', 'BMRCL-PH2A-ORR', 'Metro Rail', 'SCHEDULE_DELAY', 'MEDIUM', 'High probability of schedule delay (61.1%). Timeline revised by 17.9 months.', 'Review delayed milestones, conduct critical path bottleneck resolution, and establish fortnightly inter-agency review.', 'NEW', '2026-09-02T18:58:10.173Z')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.alerts (id, project_id, project_name, project_code, sector, alert_type, severity, message, recommended_action, status, created_at)
VALUES ('alt-cost-prj-006', 'prj-006', 'Vadhavan Deepwater All-Weather Mega Port (Phase 1 Offshore Reclamation)', 'JNPA-VADHAVAN-PORT', 'Ports & Shipping', 'COST_OVERRUN', 'MEDIUM', 'Significant cost escalation detected: 23.24% cost growth with 62.5% overrun probability.', 'Perform expenditure reconciliation, freeze non-essential scope changes, and review major EPC contract variations.', 'NEW', '2026-09-02T18:58:10.173Z')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.alerts (id, project_id, project_name, project_code, sector, alert_type, severity, message, recommended_action, status, created_at)
VALUES ('alt-delay-prj-006', 'prj-006', 'Vadhavan Deepwater All-Weather Mega Port (Phase 1 Offshore Reclamation)', 'JNPA-VADHAVAN-PORT', 'Ports & Shipping', 'SCHEDULE_DELAY', 'MEDIUM', 'High probability of schedule delay (62.4%). Timeline revised by 17.9 months.', 'Review delayed milestones, conduct critical path bottleneck resolution, and establish fortnightly inter-agency review.', 'NEW', '2026-09-02T18:58:10.173Z')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.alerts (id, project_id, project_name, project_code, sector, alert_type, severity, message, recommended_action, status, created_at)
VALUES ('alt-gap-prj-008', 'prj-008', 'Jal Jeevan Mission Urban Water Grid Supply Pipeline (Varanasi-Prayagraj)', 'JJM-URBAN-UP-WTR', 'Urban Water & Sanitation', 'PROGRESS_DIVERGENCE', 'MEDIUM', 'Financial progress (71.4%) is significantly higher than physical progress (44%). Progress gap: +27.4%.', 'Review expenditure efficiency, contractor performance, and site implementation bottlenecks.', 'NEW', '2026-09-02T18:58:10.173Z')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.alerts (id, project_id, project_name, project_code, sector, alert_type, severity, message, recommended_action, status, created_at)
VALUES ('alt-cost-prj-008', 'prj-008', 'Jal Jeevan Mission Urban Water Grid Supply Pipeline (Varanasi-Prayagraj)', 'JJM-URBAN-UP-WTR', 'Urban Water & Sanitation', 'COST_OVERRUN', 'HIGH', 'Significant cost escalation detected: 30.34% cost growth with 64.8% overrun probability.', 'Perform expenditure reconciliation, freeze non-essential scope changes, and review major EPC contract variations.', 'NEW', '2026-09-02T18:58:10.173Z')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.alerts (id, project_id, project_name, project_code, sector, alert_type, severity, message, recommended_action, status, created_at)
VALUES ('alt-delay-prj-008', 'prj-008', 'Jal Jeevan Mission Urban Water Grid Supply Pipeline (Varanasi-Prayagraj)', 'JJM-URBAN-UP-WTR', 'Urban Water & Sanitation', 'SCHEDULE_DELAY', 'MEDIUM', 'High probability of schedule delay (61.7%). Timeline revised by 15.9 months.', 'Review delayed milestones, conduct critical path bottleneck resolution, and establish fortnightly inter-agency review.', 'NEW', '2026-09-02T18:58:10.173Z')
ON CONFLICT (id) DO NOTHING;
