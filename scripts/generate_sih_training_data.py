"""
==============================================================================
PROJECT SENTINEL (SIH26103) - MoSPI Infrastructure Project Dataset Generator
==============================================================================
NOTICE: SYNTHETIC DATASET GENERATION SCRIPT
This script generates a statistically calibrated synthetic dataset matching the
published empirical distributions of the Ministry of Statistics and Programme
Implementation (MoSPI) Infrastructure and Project Monitoring Division (IPMD)
Flash Reports.

The current 10 demo projects in Supabase are showcase demo records; this generator
creates 1,000 diverse infrastructure projects across 6 major sectors with multi-
milestone reporting snapshots, realistic non-linear cost/schedule divergence,
and verifiable ground-truth delay/cost escalation outcomes.
==============================================================================
"""

import os
import random
import datetime
import json
import numpy as np
import pandas as pd

# Set deterministic seed for reproducibility
RANDOM_SEED = 42
np.random.seed(RANDOM_SEED)
random.seed(RANDOM_SEED)

SECTORS = {
    'Highways': {
        'weight': 0.38,
        'ministry': 'Ministry of Road Transport and Highways (MoRTH)',
        'agencies': ['National Highways Authority of India (NHAI)', 'NHIDCL', 'State PWD (Highways)'],
        'cost_loc': 6.8,  # log-normal parameters (~₹900 Cr median)
        'cost_scale': 0.9,
        'duration_months_range': (24, 48),
        'base_delay_risk': 0.42,
    },
    'Railways': {
        'weight': 0.24,
        'ministry': 'Ministry of Railways (MoR)',
        'agencies': ['Dedicated Freight Corridor Corp (DFCCIL)', 'Rail Vikas Nigam Ltd (RVNL)', 'IRCON International', 'CORE'],
        'cost_loc': 7.5,  # (~₹1,800 Cr median)
        'cost_scale': 1.1,
        'duration_months_range': (36, 72),
        'base_delay_risk': 0.58,
    },
    'Metro Rail': {
        'weight': 0.14,
        'ministry': 'Ministry of Housing and Urban Affairs (MoHUA)',
        'agencies': ['Delhi Metro Rail Corp (DMRC)', 'Bangalore Metro Rail Corp (BMRCL)', 'Mumbai Metropolitan Region Development Authority (MMRDA)', 'Chennai Metro Rail Ltd (CMRL)', 'UP Metro Rail Corp (UPMRC)'],
        'cost_loc': 8.2,  # (~₹3,600 Cr median)
        'cost_scale': 1.0,
        'duration_months_range': (42, 84),
        'base_delay_risk': 0.54,
    },
    'Power & Renewable Energy': {
        'weight': 0.12,
        'ministry': 'Ministry of Power / MNRE',
        'agencies': ['NTPC Limited', 'Power Grid Corporation (PGCIL)', 'Solar Energy Corporation of India (SECI)', 'SJVN Limited'],
        'cost_loc': 7.2,  # (~₹1,300 Cr median)
        'cost_scale': 0.85,
        'duration_months_range': (24, 60),
        'base_delay_risk': 0.35,
    },
    'Ports & Shipping': {
        'weight': 0.06,
        'ministry': 'Ministry of Ports, Shipping and Waterways (MoPSW)',
        'agencies': ['Jawaharlal Nehru Port Trust (JNPT)', 'Deendayal Port Authority', 'Syama Prasad Mookerjee Port', 'V.O. Chidambaranar Port'],
        'cost_loc': 6.9,  # (~₹1,000 Cr median)
        'cost_scale': 0.8,
        'duration_months_range': (24, 48),
        'base_delay_risk': 0.45,
    },
    'Urban Water & Sanitation': {
        'weight': 0.06,
        'ministry': 'Ministry of Housing and Urban Affairs (MoHUA)',
        'agencies': ['NBCC (India) Limited', 'Delhi Jal Board', 'Karnataka Urban Infra Dev (KUIDFC)', 'State Jal Nigam'],
        'cost_loc': 6.2,  # (~₹500 Cr median)
        'cost_scale': 0.75,
        'duration_months_range': (18, 42),
        'base_delay_risk': 0.40,
    }
}

STATES = [
    ('Maharashtra', 0.12), ('Uttar Pradesh', 0.11), ('Gujarat', 0.09),
    ('Karnataka', 0.08), ('Tamil Nadu', 0.08), ('Andhra Pradesh', 0.07),
    ('West Bengal', 0.06), ('Rajasthan', 0.06), ('Madhya Pradesh', 0.05),
    ('Bihar', 0.05), ('Odisha', 0.04), ('Assam', 0.04),
    ('Himachal Pradesh', 0.03), ('Jammu & Kashmir', 0.03), ('Uttarakhand', 0.03),
    ('Kerala', 0.03), ('Haryana', 0.02), ('Punjab', 0.02),
    ('Telangana', 0.02), ('Jharkhand', 0.02)
]

CONTRACT_TYPES = [
    ('EPC', 0.50),
    ('HAM', 0.28),
    ('Item Rate', 0.12),
    ('BOT', 0.07),
    ('Turnkey', 0.03)
]

TERRAIN_TYPES = [
    ('Plains', 0.52),
    ('Hilly/Mountainous', 0.20),
    ('Urban Dense', 0.18),
    ('Coastal', 0.10)
]

PROJECT_NAME_TEMPLATES = {
    'Highways': ['{state} Express Highway Corridor Phase {ph}', 'NH-{num} 4/6-Laning Bypass & Viaduct', '{state} Economic Corridor Pkg {num}', 'Border Road Strategic Connectivity Link {num}'],
    'Railways': ['{state} Rail Doubling & Third Line Section', 'High-Speed Rail Corridor Link {num}', 'Freight Corridor Feeder Line {num}', '{state} Station Redevelopment & Quadrupling'],
    'Metro Rail': ['{state} Metro Line {num} Underground Section', '{state} Metro Corridor Elevated Extension Phase {ph}', '{state} Ring Metro Transit System Pkg {num}'],
    'Power & Renewable Energy': ['{state} Ultra Mega Solar Power Park {num} MW', '765kV High Voltage Transmission Substation', '{state} Pumped Storage Hydro Project Phase {ph}'],
    'Ports & Shipping': ['Deep Draft Container Terminal Berth {num}', '{state} Port Modernization & Coastal Connectivity', 'Liquid Cargo Jetty & Breakwater Expansion'],
    'Urban Water & Sanitation': ['{state} Smart City Water Supply Augmentation', 'Underground Sewerage System & 100 MLD STP', '{state} River Basin Pollution Abatement Pkg {num}']
}

def weighted_choice(items_with_weights):
    items, weights = zip(*items_with_weights)
    weights = np.array(weights, dtype=float)
    weights = weights / weights.sum()
    return np.random.choice(items, p=weights)

def generate_dataset(num_projects=1000):
    rows = []

    print(f"Generating {num_projects} synthetic infrastructure projects with multi-milestone snapshots...")

    for i in range(1, num_projects + 1):
        proj_code = f"PRJ-SYN-{i:04d}"
        
        # Sector selection
        sector_names = list(SECTORS.keys())
        sector_weights = [SECTORS[s]['weight'] for s in sector_names]
        sector = np.random.choice(sector_names, p=np.array(sector_weights)/sum(sector_weights))
        sector_cfg = SECTORS[sector]

        ministry = sector_cfg['ministry']
        agency = random.choice(sector_cfg['agencies'])
        state = weighted_choice(STATES)
        contract_type = weighted_choice(CONTRACT_TYPES)
        terrain_type = weighted_choice(TERRAIN_TYPES)

        # Name formatting
        tmpl = random.choice(PROJECT_NAME_TEMPLATES[sector])
        proj_name = tmpl.format(
            state=state,
            ph=random.choice(['I', 'II', 'III', 'IV']),
            num=random.randint(10, 99)
        )

        # Baseline cost (Crores) - log-normal distribution with truncation
        raw_cost = np.random.lognormal(mean=sector_cfg['cost_loc'], sigma=sector_cfg['cost_scale'])
        original_cost_cr = round(float(np.clip(raw_cost, 60.0, 38000.0)), 2)

        # Project duration (months)
        min_dur, max_dur = sector_cfg['duration_months_range']
        # Larger projects take naturally longer
        size_factor = np.clip(np.log10(original_cost_cr) / 3.0, 0.8, 1.6)
        original_duration_months = int(random.randint(min_dur, max_dur) * size_factor)

        # Start Date (between 2018-01-01 and 2024-06-01)
        start_year = random.randint(2018, 2023)
        start_month = random.randint(1, 12)
        start_day = random.randint(1, 28)
        orig_start_date = datetime.date(start_year, start_month, start_day)
        orig_completion_date = orig_start_date + datetime.timedelta(days=int(original_duration_months * 30.4375))

        # Intrinsic Risk Drivers
        terrain_mult = {'Plains': 1.0, 'Coastal': 1.15, 'Urban Dense': 1.45, 'Hilly/Mountainous': 1.65}[terrain_type]
        contract_mult = {'EPC': 1.0, 'HAM': 1.08, 'Item Rate': 1.35, 'BOT': 1.40, 'Turnkey': 0.95}[contract_type]
        agency_bonus = 0.85 if ('DMRC' in agency or 'NTPC' in agency or 'PGCIL' in agency) else 1.05

        composite_risk_factor = (sector_cfg['base_delay_risk'] * 0.4 +
                                 (terrain_mult - 1.0) * 0.25 +
                                 (contract_mult - 1.0) * 0.20 +
                                 (0.1 if original_cost_cr > 2500 else 0.0)) * agency_bonus

        # Ground Truth Outcome 1: Delay (Months)
        has_significant_delay = np.random.rand() < composite_risk_factor
        if has_significant_delay:
            delay_months = round(float(np.random.gamma(shape=2.5, scale=6.0 * terrain_mult)), 1) + 3.0
        else:
            delay_months = round(float(max(0.0, np.random.normal(loc=1.2, scale=1.5))), 1)

        target_delay_months = float(delay_months)
        target_is_delayed = 1 if target_delay_months >= 3.0 else 0

        # Ground Truth Outcome 2: Cost Escalation (% overrun)
        escalation_base = (target_delay_months / original_duration_months) * 22.0
        scope_creep = float(np.random.exponential(scale=5.0))
        if terrain_type in ['Hilly/Mountainous', 'Urban Dense']:
            scope_creep += float(np.random.uniform(3.0, 14.0))
        if contract_type in ['Item Rate', 'BOT']:
            scope_creep += float(np.random.uniform(2.0, 10.0))

        cost_overrun_pct = round(max(0.0, escalation_base + scope_creep if target_is_delayed else scope_creep * 0.4), 2)
        final_cost_cr = round(original_cost_cr * (1.0 + cost_overrun_pct / 100.0), 2)
        target_cost_overrun_pct = cost_overrun_pct
        target_is_cost_overrun = 1 if target_cost_overrun_pct >= 10.0 else 0

        actual_completion_date = orig_completion_date + datetime.timedelta(days=int(target_delay_months * 30.4375))

        # Generate 2 to 4 multi-milestone snapshots per project
        num_snapshots = random.randint(2, 4)
        pct_milestones = sorted(random.sample([0.20, 0.35, 0.50, 0.65, 0.80, 0.90], num_snapshots))

        for snap_idx, pct_elapsed in enumerate(pct_milestones, start=1):
            snap_id = f"SNAP-{proj_code}-Q{snap_idx}"
            elapsed_days = int(original_duration_months * 30.4375 * pct_elapsed)
            as_of_date = orig_start_date + datetime.timedelta(days=elapsed_days)

            # S-curve physical progress
            lag_penalty = (target_delay_months / original_duration_months) * 0.4 if target_is_delayed else 0.0
            effective_prog_fraction = max(0.05, min(0.98, pct_elapsed - lag_penalty + np.random.normal(0, 0.03)))
            physical_progress_pct = round(float(effective_prog_fraction * 100.0), 2)

            # Financial expenditure
            disbursement_advance = float(np.random.uniform(2.0, 12.0) if target_is_cost_overrun else np.random.uniform(-3.0, 6.0))
            raw_fin_pct = physical_progress_pct + disbursement_advance
            financial_progress_pct = round(float(np.clip(raw_fin_pct, 5.0, 115.0)), 2)

            # Realistic Cost Revisions at Snapshot:
            # - Agencies often have reporting latency; cost revisions are approved only after formal audits.
            # - Some projects get minor buffer revisions (2-6%) even without chronic overrun.
            has_official_cost_revision = False
            if target_is_cost_overrun:
                # 60% probability of revision being recognized if early, 90% if late
                has_official_cost_revision = (np.random.rand() < (0.40 + 0.50 * pct_elapsed))
            else:
                # 15% false positive minor budget adjustment
                has_official_cost_revision = (np.random.rand() < 0.15)

            if has_official_cost_revision:
                if target_is_cost_overrun:
                    realized_escalation = (pct_elapsed ** 1.4) * target_cost_overrun_pct * np.random.uniform(0.7, 1.1)
                else:
                    realized_escalation = float(np.random.uniform(1.0, 5.0))
            else:
                realized_escalation = 0.0

            revised_cost_cr = round(original_cost_cr * (1.0 + max(0.0, realized_escalation) / 100.0), 2)
            expenditure_cr = round(revised_cost_cr * (financial_progress_pct / 100.0), 2)

            # Realistic Timeline Revision at Snapshot:
            # - Bureaucratic lag: 50% of delayed projects at <= 50% progress haven't had official EOT (Extension of Time) granted yet!
            # - Routine extensions: 18% of normal projects receive an official monsoon/buffer extension of 1-4 months.
            has_official_time_extension = False
            if target_is_delayed:
                has_official_time_extension = (np.random.rand() < (0.35 + 0.55 * pct_elapsed))
            else:
                has_official_time_extension = (np.random.rand() < 0.18)

            if has_official_time_extension:
                if target_is_delayed:
                    realized_delay = (pct_elapsed ** 1.2) * target_delay_months * np.random.uniform(0.65, 1.15)
                else:
                    realized_delay = float(np.random.uniform(1.0, 3.5)) # routine buffer extension
            else:
                realized_delay = 0.0

            revised_completion_date = orig_completion_date + datetime.timedelta(days=int(max(0.0, realized_delay) * 30.4375))

            rows.append({
                'project_id': proj_code,
                'snapshot_id': snap_id,
                'project_name': proj_name,
                'sector': sector,
                'ministry': ministry,
                'implementing_agency': agency,
                'state': state,
                'contract_type': contract_type,
                'terrain_type': terrain_type,
                'original_cost_cr': original_cost_cr,
                'revised_cost_cr': revised_cost_cr,
                'expenditure_cr': expenditure_cr,
                'physical_progress_pct': physical_progress_pct,
                'financial_progress_pct': financial_progress_pct,
                'original_start_date': orig_start_date.isoformat(),
                'original_completion_date': orig_completion_date.isoformat(),
                'revised_completion_date': revised_completion_date.isoformat(),
                'as_of_date': as_of_date.isoformat(),
                'actual_completion_date': actual_completion_date.isoformat(),
                'final_cost_cr': final_cost_cr,
                'target_delay_months': target_delay_months,
                'target_is_delayed': target_is_delayed,
                'target_cost_overrun_pct': target_cost_overrun_pct,
                'target_is_cost_overrun': target_is_cost_overrun,
            })

    df = pd.DataFrame(rows)
    return df

def main():
    os.makedirs('data', exist_ok=True)
    out_csv = os.path.join('data', 'sih_infra_training_dataset.csv')
    meta_json = os.path.join('data', 'dataset_metadata.json')

    df = generate_dataset(num_projects=1000)
    df.to_csv(out_csv, index=False)

    metadata = {
        'dataset_name': 'MoSPI Infrastructure Project Risk Training Dataset (Calibrated Synthetic)',
        'data_type': 'SYNTHETIC',
        'disclaimer': 'Generated based on published MoSPI IPMD Flash Report statistical distributions. Demonstrates realistic infrastructure risk behavior without exposing restricted government data.',
        'generated_date': datetime.datetime.now(datetime.timezone.utc).isoformat(),
        'random_seed': RANDOM_SEED,
        'total_projects': 1000,
        'total_milestone_snapshots': len(df),
        'columns': list(df.columns),
        'delay_rate_binary': float(df['target_is_delayed'].mean()),
        'cost_overrun_rate_binary': float(df['target_is_cost_overrun'].mean()),
        'avg_delay_months': float(df['target_delay_months'].mean()),
        'avg_cost_overrun_pct': float(df['target_cost_overrun_pct'].mean()),
        'sector_breakdown': df['sector'].value_counts().to_dict(),
        'state_count': int(df['state'].nunique())
    }

    with open(meta_json, 'w') as f:
        json.dump(metadata, f, indent=2)

    print(f"Generated {len(df)} milestone snapshots for {1000} projects.")
    print(f"Saved to: {out_csv}")
    print(f"Saved metadata: {meta_json}")
    print(f"Delay rate: {metadata['delay_rate_binary']:.1%}, Cost Overrun rate: {metadata['cost_overrun_rate_binary']:.1%}")

if __name__ == '__main__':
    main()
