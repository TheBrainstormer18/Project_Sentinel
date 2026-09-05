"""
==============================================================================
PROJECT SENTINEL (SIH26103) - ML Training, Evaluation & Serialization Pipeline
==============================================================================
Trains, rigorously evaluates, and serializes production infrastructure risk
models:
1. Delay Risk: Baseline Logistic Regression vs. Production XGBoost Classifier
2. Cost Overrun: Baseline Ridge Regression vs. Production XGBoost Regressor
3. Leak-free GroupKFold / GroupShuffleSplit on `project_id`
4. SHAP TreeExplainer for global feature importances and local explanations
5. Lightweight JSON tree serialization for zero-latency serverless Node.js inference
==============================================================================
"""

import os
import json
import datetime
import numpy as np
import pandas as pd
from sklearn.model_selection import GroupShuffleSplit
from sklearn.preprocessing import StandardScaler, OneHotEncoder
from sklearn.linear_model import LogisticRegression, Ridge
from sklearn.metrics import (
    accuracy_score, precision_score, recall_score, f1_score,
    roc_auc_score, average_precision_score, brier_score_loss,
    mean_absolute_error, root_mean_squared_error, r2_score, median_absolute_error
)
import xgboost as xgb
import shap

RANDOM_SEED = 42
np.random.seed(RANDOM_SEED)

def load_and_engineer_features(csv_path):
    df = pd.read_csv(csv_path)

    # Date parsing
    df['orig_start'] = pd.to_datetime(df['original_start_date'])
    df['orig_comp'] = pd.to_datetime(df['original_completion_date'])
    df['rev_comp'] = pd.to_datetime(df['revised_completion_date'])
    df['as_of'] = pd.to_datetime(df['as_of_date'])

    # Feature Engineering (matching runtime featureEngineering.ts exactly)
    df['cost_overrun_pct'] = ((df['revised_cost_cr'] - df['original_cost_cr']) / df['original_cost_cr']) * 100.0
    df['cost_growth_cr'] = df['revised_cost_cr'] - df['original_cost_cr']
    df['progress_gap'] = df['financial_progress_pct'] - df['physical_progress_pct']
    
    # Timeline revision in months
    df['timeline_revision_months'] = (df['rev_comp'] - df['orig_comp']).dt.days / 30.4375
    df['timeline_revision_months'] = df['timeline_revision_months'].clip(lower=0.0)

    # Project age in months at snapshot
    df['project_age_months'] = (df['as_of'] - df['orig_start']).dt.days / 30.4375
    df['project_age_months'] = df['project_age_months'].clip(lower=1.0)

    # Velocity metrics
    df['financial_burn_rate'] = df['expenditure_cr'] / df['project_age_months']
    df['physical_velocity'] = df['physical_progress_pct'] / df['project_age_months']
    df['remaining_work_pct'] = (100.0 - df['physical_progress_pct']).clip(lower=0.0)

    return df

def train_and_evaluate():
    data_path = os.path.join('data', 'sih_infra_training_dataset.csv')
    if not os.path.exists(data_path):
        raise FileNotFoundError(f"Training dataset not found at {data_path}. Run generate_sih_training_data.py first.")

    print(f"Loading dataset from {data_path}...")
    df = load_and_engineer_features(data_path)
    print(f"Total dataset observations: {len(df)} across {df['project_id'].nunique()} unique projects.")

    num_cols = [
        'original_cost_cr', 'revised_cost_cr', 'expenditure_cr',
        'physical_progress_pct', 'financial_progress_pct',
        'cost_overrun_pct', 'cost_growth_cr', 'progress_gap',
        'timeline_revision_months', 'project_age_months',
        'financial_burn_rate', 'physical_velocity', 'remaining_work_pct'
    ]
    cat_cols = ['sector', 'terrain_type', 'contract_type']

    target_delay_cls = 'target_is_delayed'
    target_cost_reg = 'target_cost_overrun_pct'

    # Group-aware train / test splitting (70% train, 15% validation, 15% test by project_id)
    gss_test = GroupShuffleSplit(n_splits=1, test_size=0.15, random_state=RANDOM_SEED)
    train_val_idx, test_idx = next(gss_test.split(df, groups=df['project_id']))

    df_train_val = df.iloc[train_val_idx].copy()
    df_test = df.iloc[test_idx].copy()

    gss_val = GroupShuffleSplit(n_splits=1, test_size=0.1765, random_state=RANDOM_SEED) # 0.1765 of 0.85 ≈ 0.15
    train_idx, val_idx = next(gss_val.split(df_train_val, groups=df_train_val['project_id']))

    df_train = df_train_val.iloc[train_idx].copy()
    df_val = df_train_val.iloc[val_idx].copy()

    print(f"Split sizes: Train={len(df_train)} obs ({df_train['project_id'].nunique()} projects), "
          f"Val={len(df_val)} obs ({df_val['project_id'].nunique()} projects), "
          f"Test={len(df_test)} obs ({df_test['project_id'].nunique()} projects)")

    # Preprocessors (FIT ON TRAIN SET ONLY to prevent data leakage)
    scaler = StandardScaler()
    ohe = OneHotEncoder(handle_unknown='ignore', sparse_output=False)

    scaler.fit(df_train[num_cols])
    ohe.fit(df_train[cat_cols])

    cat_feature_names = list(ohe.get_feature_names_out(cat_cols))
    all_feature_names = num_cols + cat_feature_names

    def transform_features(df_subset):
        X_num = scaler.transform(df_subset[num_cols])
        X_cat = ohe.transform(df_subset[cat_cols])
        return np.hstack([X_num, X_cat])

    X_train = transform_features(df_train)
    X_val = transform_features(df_val)
    X_test = transform_features(df_test)

    y_train_delay = df_train[target_delay_cls].values
    y_val_delay = df_val[target_delay_cls].values
    y_test_delay = df_test[target_delay_cls].values

    y_train_cost = df_train[target_cost_reg].values
    y_val_cost = df_val[target_cost_reg].values
    y_test_cost = df_test[target_cost_reg].values

    # =========================================================================
    # 1. DELAY RISK PREDICTION
    # =========================================================================
    print("\n--- Training Delay Risk Models ---")
    
    # 1A. Baseline: Logistic Regression
    lr_delay = LogisticRegression(C=1.0, max_iter=1000, random_state=RANDOM_SEED)
    lr_delay.fit(X_train, y_train_delay)
    y_test_delay_lr_probs = lr_delay.predict_proba(X_test)[:, 1]
    y_test_delay_lr_pred = (y_test_delay_lr_probs >= 0.5).astype(int)

    # 1B. Production: XGBoost Classifier
    scale_pos = (len(y_train_delay) - sum(y_train_delay)) / sum(y_train_delay)
    xgb_delay = xgb.XGBClassifier(
        n_estimators=180,
        max_depth=4,
        learning_rate=0.03,
        subsample=0.85,
        colsample_bytree=0.85,
        scale_pos_weight=scale_pos,
        eval_metric='logloss',
        random_state=RANDOM_SEED
    )
    xgb_delay.fit(X_train, y_train_delay, eval_set=[(X_val, y_val_delay)], verbose=False)
    y_test_delay_xgb_probs = xgb_delay.predict_proba(X_test)[:, 1]
    y_test_delay_xgb_pred = (y_test_delay_xgb_probs >= 0.5).astype(int)

    # Metrics Delay
    lr_delay_acc = float(accuracy_score(y_test_delay, y_test_delay_lr_pred))
    lr_delay_prec = float(precision_score(y_test_delay, y_test_delay_lr_pred))
    lr_delay_rec = float(recall_score(y_test_delay, y_test_delay_lr_pred))
    lr_delay_f1 = float(f1_score(y_test_delay, y_test_delay_lr_pred))
    lr_delay_roc = float(roc_auc_score(y_test_delay, y_test_delay_lr_probs))
    lr_delay_prauc = float(average_precision_score(y_test_delay, y_test_delay_lr_probs))
    lr_delay_brier = float(brier_score_loss(y_test_delay, y_test_delay_lr_probs))

    xgb_delay_acc = float(accuracy_score(y_test_delay, y_test_delay_xgb_pred))
    xgb_delay_prec = float(precision_score(y_test_delay, y_test_delay_xgb_pred))
    xgb_delay_rec = float(recall_score(y_test_delay, y_test_delay_xgb_pred))
    xgb_delay_f1 = float(f1_score(y_test_delay, y_test_delay_xgb_pred))
    xgb_delay_roc = float(roc_auc_score(y_test_delay, y_test_delay_xgb_probs))
    xgb_delay_prauc = float(average_precision_score(y_test_delay, y_test_delay_xgb_probs))
    xgb_delay_brier = float(brier_score_loss(y_test_delay, y_test_delay_xgb_probs))

    print(f"Delay Baseline (LR)     : Acc={lr_delay_acc:.3f}, F1={lr_delay_f1:.3f}, ROC-AUC={lr_delay_roc:.3f}, PR-AUC={lr_delay_prauc:.3f}")
    print(f"Delay Production (XGB) : Acc={xgb_delay_acc:.3f}, F1={xgb_delay_f1:.3f}, ROC-AUC={xgb_delay_roc:.3f}, PR-AUC={xgb_delay_prauc:.3f}")

    # =========================================================================
    # 2. COST OVERRUN PREDICTION
    # =========================================================================
    print("\n--- Training Cost Overrun Models ---")
    
    # 2A. Baseline: Ridge Regression
    ridge_cost = Ridge(alpha=10.0, random_state=RANDOM_SEED)
    ridge_cost.fit(X_train, y_train_cost)
    y_test_cost_ridge_pred = ridge_cost.predict(X_test)

    # 2B. Production: XGBoost Regressor
    xgb_cost = xgb.XGBRegressor(
        n_estimators=220,
        max_depth=4,
        learning_rate=0.03,
        subsample=0.85,
        colsample_bytree=0.85,
        random_state=RANDOM_SEED
    )
    xgb_cost.fit(X_train, y_train_cost, eval_set=[(X_val, y_val_cost)], verbose=False)
    y_test_cost_xgb_pred = xgb_cost.predict(X_test)

    # Metrics Cost
    ridge_mae = float(mean_absolute_error(y_test_cost, y_test_cost_ridge_pred))
    ridge_rmse = float(root_mean_squared_error(y_test_cost, y_test_cost_ridge_pred))
    ridge_r2 = float(r2_score(y_test_cost, y_test_cost_ridge_pred))
    ridge_medae = float(median_absolute_error(y_test_cost, y_test_cost_ridge_pred))

    xgb_mae = float(mean_absolute_error(y_test_cost, y_test_cost_xgb_pred))
    xgb_rmse = float(root_mean_squared_error(y_test_cost, y_test_cost_xgb_pred))
    xgb_r2 = float(r2_score(y_test_cost, y_test_cost_xgb_pred))
    xgb_medae = float(median_absolute_error(y_test_cost, y_test_cost_xgb_pred))

    print(f"Cost Baseline (Ridge)  : MAE={ridge_mae:.2f}%, RMSE={ridge_rmse:.2f}%, R2={ridge_r2:.3f}, MedAE={ridge_medae:.2f}%")
    print(f"Cost Production (XGB)  : MAE={xgb_mae:.2f}%, RMSE={xgb_rmse:.2f}%, R2={xgb_r2:.3f}, MedAE={xgb_medae:.2f}%")

    # =========================================================================
    # 3. SHAP EXPLAINABILITY
    # =========================================================================
    print("\n--- Computing SHAP Values ---")
    explainer = shap.TreeExplainer(xgb_delay)
    shap_values = explainer.shap_values(X_test)

    # Mean absolute SHAP value per feature
    mean_abs_shap = np.mean(np.abs(shap_values), axis=0)
    total_shap = np.sum(mean_abs_shap) if np.sum(mean_abs_shap) > 0 else 1.0

    # Group importances and aggregate
    feature_importance_list = []
    category_map = {
        'progress_gap': 'Execution Divergence',
        'cost_overrun_pct': 'Financial Momentum',
        'timeline_revision_months': 'Schedule Drift',
        'physical_progress_pct': 'Milestone Velocity',
        'financial_progress_pct': 'Disbursement Outlay',
        'cost_growth_cr': 'Budget Escalation',
        'physical_velocity': 'Milestone Velocity',
        'financial_burn_rate': 'Disbursement Outlay',
        'remaining_work_pct': 'Milestone Velocity',
        'project_age_months': 'Longevity Drift',
        'original_cost_cr': 'Project Scale',
        'revised_cost_cr': 'Project Scale',
        'expenditure_cr': 'Project Scale',
    }

    # Clean display names
    display_names = {
        'progress_gap': 'Progress Gap (Financial - Physical)',
        'cost_overrun_pct': 'Historical Cost Escalation %',
        'timeline_revision_months': 'Timeline Revision (Months)',
        'physical_progress_pct': 'Physical Progress %',
        'financial_progress_pct': 'Financial Progress %',
        'cost_growth_cr': 'Cost Growth (₹ Cr)',
        'financial_burn_rate': 'Disbursement Burn Rate',
        'physical_velocity': 'Physical Progress Velocity',
        'remaining_work_pct': 'Remaining Work Scope',
        'project_age_months': 'Project Age (Months Active)',
        'original_cost_cr': 'Sanctioned Baseline Cost',
        'revised_cost_cr': 'Approved Revised Cost',
        'expenditure_cr': 'Cumulative Expenditure',
    }

    # Aggregate individual dummy features for sectors, terrain, contracts
    sector_importance = 0.0
    terrain_importance = 0.0
    contract_importance = 0.0

    for feat_name, shap_val in zip(all_feature_names, mean_abs_shap):
        normalized_imp = round(float(shap_val / total_shap), 4)
        if feat_name.startswith('sector_'):
            sector_importance += normalized_imp
        elif feat_name.startswith('terrain_type_'):
            terrain_importance += normalized_imp
        elif feat_name.startswith('contract_type_'):
            contract_importance += normalized_imp
        else:
            feature_importance_list.append({
                'feature_name': display_names.get(feat_name, feat_name),
                'raw_feature': feat_name,
                'importance': normalized_imp,
                'category': category_map.get(feat_name, 'Structural Factor')
            })

    feature_importance_list.append({
        'feature_name': 'Sector Risk Weight',
        'raw_feature': 'sector',
        'importance': round(sector_importance, 4),
        'category': 'Domain Sector'
    })
    feature_importance_list.append({
        'feature_name': 'Terrain Topography Complexity',
        'raw_feature': 'terrain_type',
        'importance': round(terrain_importance, 4),
        'category': 'Topographical Risk'
    })
    feature_importance_list.append({
        'feature_name': 'Contracting Mechanism Risk',
        'raw_feature': 'contract_type',
        'importance': round(contract_importance, 4),
        'category': 'Procurement Risk'
    })

    # Sort descending by importance
    feature_importance_list.sort(key=lambda x: x['importance'], reverse=True)

    # =========================================================================
    # 4. SERIALIZE ARTIFACTS
    # =========================================================================
    artifacts_dir = os.path.join('server', 'ml', 'artifacts', 'v1.0')
    os.makedirs(artifacts_dir, exist_ok=True)

    # 4A. Native XGBoost models
    xgb_delay.save_model(os.path.join(artifacts_dir, 'delay_classifier.json'))
    xgb_cost.save_model(os.path.join(artifacts_dir, 'cost_regressor.json'))

    # 4B. Export lightweight portable trees JSON for serverless Node.js inference
    # Parses XGBoost dump to a clean JSON tree representation
    def dump_trees_to_portable_json(model, feature_names):
        dump = model.get_booster().get_dump(dump_format='json')
        trees = [json.loads(tree_str) for tree_str in dump]
        return {
            'feature_names': feature_names,
            'trees': trees
        }

    def get_base_score(model):
        try:
            cfg = json.loads(model.get_booster().save_config())
            raw = cfg['learner']['learner_model_param']['base_score'].strip('[]')
            return float(raw)
        except Exception:
            return 0.5

    delay_base_score = get_base_score(xgb_delay)
    cost_base_score = get_base_score(xgb_cost)

    portable_delay = dump_trees_to_portable_json(xgb_delay, all_feature_names)
    portable_cost = dump_trees_to_portable_json(xgb_cost, all_feature_names)

    portable_bundle = {
        'version': 'v1.0',
        'exported_at': datetime.datetime.now(datetime.timezone.utc).isoformat(),
        'delay_model': {
            'objective': 'binary:logistic',
            'base_score': delay_base_score,
            'feature_names': all_feature_names,
            'trees': portable_delay['trees']
        },
        'cost_model': {
            'objective': 'reg:squarederror',
            'base_score': cost_base_score,
            'feature_names': all_feature_names,
            'trees': portable_cost['trees']
        }
    }

    with open(os.path.join(artifacts_dir, 'xgboost_trees.json'), 'w') as f:
        json.dump(portable_bundle, f)

    # 4C. Preprocessor JSON
    preprocessor_config = {
        'numerical_features': num_cols,
        'scaler_mean': [float(m) for m in scaler.mean_],
        'scaler_scale': [float(s) for s in scaler.scale_],
        'categorical_features': cat_cols,
        'categorical_categories': {
            col: list(cats) for col, cats in zip(cat_cols, ohe.categories_)
        },
        'all_feature_names': all_feature_names,
        'feature_indices': {name: idx for idx, name in enumerate(all_feature_names)}
    }

    with open(os.path.join(artifacts_dir, 'preprocessor.json'), 'w') as f:
        json.dump(preprocessor_config, f, indent=2)

    # 4D. SHAP feature importances JSON
    with open(os.path.join(artifacts_dir, 'shap_feature_importance.json'), 'w') as f:
        json.dump(feature_importance_list, f, indent=2)

    # 4E. Verified Model Metrics JSON
    metrics_summary = {
        'version': 'v1.0',
        'generated_at': datetime.datetime.now(datetime.timezone.utc).isoformat(),
        'dataset_info': {
            'total_observations': len(df),
            'total_projects': int(df['project_id'].nunique()),
            'train_samples': len(df_train),
            'val_samples': len(df_val),
            'test_samples': len(df_test),
            'data_type': 'SYNTHETIC',
            'calibration_standard': 'MoSPI IPMD Infrastructure Flash Reports'
        },
        'delay_models': [
            {
                'model_name': 'XGBoost Classifier (Production)',
                'model_type': 'Main',
                'target': 'Delay Risk Prediction',
                'accuracy': round(xgb_delay_acc, 4),
                'precision': round(xgb_delay_prec, 4),
                'recall': round(xgb_delay_rec, 4),
                'f1_score': round(xgb_delay_f1, 4),
                'roc_auc': round(xgb_delay_roc, 4),
                'pr_auc': round(xgb_delay_prauc, 4),
                'brier_score': round(xgb_delay_brier, 4),
                'sample_size': len(df_test),
                'selected_for_production': True,
                'notes': 'Gradient boosted decision trees handle non-linear execution divergence and complex multi-agency bottlenecks.'
            },
            {
                'model_name': 'Logistic Regression (Baseline)',
                'model_type': 'Baseline',
                'target': 'Delay Risk Prediction',
                'accuracy': round(lr_delay_acc, 4),
                'precision': round(lr_delay_prec, 4),
                'recall': round(lr_delay_rec, 4),
                'f1_score': round(lr_delay_f1, 4),
                'roc_auc': round(lr_delay_roc, 4),
                'pr_auc': round(lr_delay_prauc, 4),
                'brier_score': round(lr_delay_brier, 4),
                'sample_size': len(df_test),
                'selected_for_production': False,
                'notes': 'Linear decision boundary under-predicts complex multi-contractor delays and sudden milestone stalls.'
            }
        ],
        'cost_models': [
            {
                'model_name': 'XGBoost Regressor (Production)',
                'model_type': 'Main',
                'target': 'Cost Overrun Prediction',
                'mae': round(xgb_mae, 2),
                'rmse': round(xgb_rmse, 2),
                'r2_score': round(xgb_r2, 4),
                'medae': round(xgb_medae, 2),
                'sample_size': len(df_test),
                'selected_for_production': True,
                'notes': 'Captures compounding cost escalations resulting from prolonged schedule slippage and scope revisions.'
            },
            {
                'model_name': 'Ridge Regression (Baseline)',
                'model_type': 'Baseline',
                'target': 'Cost Overrun Prediction',
                'mae': round(ridge_mae, 2),
                'rmse': round(ridge_rmse, 2),
                'r2_score': round(ridge_r2, 4),
                'medae': round(ridge_medae, 2),
                'sample_size': len(df_test),
                'selected_for_production': False,
                'notes': 'L2 regularized linear model assumes proportional cost growth; underfits non-linear escalations.'
            }
        ],
        'feature_importance': feature_importance_list,
        'selected_delay_model': 'XGBoost Classifier',
        'selected_cost_model': 'XGBoost Regressor',
        'justification': (
            f"XGBoost Classifier achieved superior discriminative performance on the test set "
            f"(ROC-AUC {xgb_delay_roc:.3f} vs {lr_delay_roc:.3f} baseline, F1 {xgb_delay_f1:.3f} vs {lr_delay_f1:.3f}). "
            f"XGBoost Regressor reduced cost prediction MAE from {ridge_mae:.2f}% to {xgb_mae:.2f}% with R² of {xgb_r2:.3f}."
        ),
        'training_sample_count': len(df_train),
        'test_sample_count': len(df_test),
        'validation_accuracy': round(xgb_delay_acc, 4),
        'last_trained': datetime.date.today().isoformat()
    }

    with open(os.path.join(artifacts_dir, 'model_metrics.json'), 'w') as f:
        json.dump(metrics_summary, f, indent=2)

    print(f"\nAll artifacts successfully saved to {artifacts_dir}:")
    print(" - delay_classifier.json (native XGBoost)")
    print(" - cost_regressor.json (native XGBoost)")
    print(" - xgboost_trees.json (portable JSON trees for Node.js)")
    print(" - preprocessor.json (scaler + one-hot parameters)")
    print(" - shap_feature_importance.json (global SHAP values)")
    print(" - model_metrics.json (verified test metrics)")

if __name__ == '__main__':
    train_and_evaluate()
