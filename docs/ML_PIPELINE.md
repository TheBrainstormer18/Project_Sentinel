# Project Sentinel: Machine Learning Risk Prediction Pipeline (SIH26103)

## Executive Summary

**Project Sentinel** is an AI-powered Infrastructure Project Monitoring and Early-Warning Risk Management Platform developed under the **Smart India Hackathon (SIH26103)** blueprint for the **Ministry of Statistics and Programme Implementation (MoSPI)** and the **Infrastructure and Project Monitoring Division (IPMD)**.

This document details the architecture, statistical methodology, empirical validation benchmarks, explainable AI (XAI) engine, and serverless inference pipeline that powers Project Sentinel's risk predictions.

---

## 1. Dataset Specification & Synthetic Disclaimer

> [!IMPORTANT]
> **Dataset Classification: Calibrated Synthetic Benchmark**
> Due to statutory confidentiality and national infrastructure security protocols, raw internal PAIMANA project databases are restricted. The initial training dataset (`data/sih_infra_training_dataset.csv`) is a **statistically calibrated synthetic dataset** generated in strict accordance with the published empirical distributions of MoSPI IPMD Annual and Monthly Flash Reports.
> 
> The 10 demo projects in Supabase are strictly seed/showcase records; they were **NOT** used to train the machine learning models.

### Dataset Parameters
- **Total Projects**: 1,000 unique infrastructure projects across 20 Indian States / Union Territories.
- **Total Milestone Observations**: 3,019 multi-quarter snapshot records.
- **Sectors Covered**:
  1. **Road Transport & Highways** (MoRTH / NHAI, NHIDCL) — 38%
  2. **Railways** (MoR / DFCCIL, RVNL, IRCON) — 24%
  3. **Metro Rail Transit** (MoHUA / DMRC, BMRCL, MMRDA) — 14%
  4. **Power & Renewable Energy** (MoP, MNRE / NTPC, PGCIL, SECI) — 12%
  5. **Ports & Shipping** (MoPSW / JNPA, Deendayal Port) — 6%
  6. **Urban Water & Sanitation** (MoHUA / NBCC, State Jal Boards) — 6%
- **Procurement Contracts**: EPC (50%), HAM (28%), Item Rate (12%), BOT (7%), Turnkey (3%).
- **Topography Types**: Plains (52%), Hilly/Mountainous (20%), Urban Dense (18%), Coastal (10%).

---

## 2. Leak-Free Cross-Validation Strategy

To ensure scientific rigor and zero target leakage across multi-milestone project histories:
1. **Group-Aware Partitioning**: Data is split using `GroupShuffleSplit` partitioned strictly by `project_id`. All temporal milestone snapshots for any given project remain in the same partition.
2. **Splits**:
   - **Training Set**: 70% (2,087 observations across 699 projects)
   - **Validation Set**: 15% (464 observations across 151 projects)
   - **Unbiased Test Benchmark**: 15% (468 observations across 150 projects)
3. **Strict Preprocessing Isolation**:
   - `StandardScaler` fitted on the Training partition only.
   - `OneHotEncoder` fitted on the Training partition only.
   - Means, scales, and categorical categories serialized to `server/ml/artifacts/v1.0/preprocessor.json`.

---

## 3. Model Architecture & Training

### 3.1 Delay Risk Prediction (Binary Classification)
- **Target Variable**: `target_is_delayed` (1 if completion delay $\ge 3.0$ months, 0 otherwise).
- **Baseline Model**: L2-penalized **Logistic Regression** ($C=1.0$).
- **Production Model**: **XGBoost Classifier** (`XGBClassifier`):
  - `n_estimators`: 180
  - `max_depth`: 4
  - `learning_rate`: 0.03
  - `subsample`: 0.85
  - `colsample_bytree`: 0.85
  - `scale_pos_weight`: Balanced for sector delay frequency
  - `eval_metric`: `logloss`

### 3.2 Cost Overrun Prediction (Continuous Regression)
- **Target Variable**: `target_cost_overrun_pct` (Percentage escalation: $\frac{\text{Final Cost} - \text{Original Cost}}{\text{Original Cost}} \times 100$).
- **Baseline Model**: **Ridge Regression** ($\alpha=10.0$).
- **Production Model**: **XGBoost Regressor** (`XGBRegressor`):
  - `n_estimators`: 220
  - `max_depth`: 4
  - `learning_rate`: 0.03
  - `subsample`: 0.85
  - `colsample_bytree`: 0.85
  - `objective`: `reg:squarederror`

---

## 4. Empirical Test Benchmark Evaluation

The models were evaluated on the **untouched test benchmark (468 observations across 150 projects)**. Real results exported to `server/ml/artifacts/v1.0/model_metrics.json`:

### A. Schedule Delay Risk Benchmark
| Metric | Baseline (Logistic Regression) | Production (XGBoost Classifier) | Absolute Gain |
| :--- | :---: | :---: | :---: |
| **Accuracy** | 84.8% | **88.7%** | **+3.9%** |
| **Precision** | 86.2% | **89.8%** | **+3.6%** |
| **Recall** | 73.7% | **80.7%** | **+7.0%** |
| **F1-Score** | 0.794 | **0.850** | **+0.056** |
| **ROC-AUC** | 0.915 | **0.950** | **+0.035** |
| **PR-AUC (Avg Precision)** | 0.906 | **0.941** | **+0.035** |
| **Brier Score (Calibration)** | 0.110 | **0.084** | **-23.6% (Superior)** |

### B. Cost Escalation Benchmark
| Metric | Baseline (Ridge Regression) | Production (XGBoost Regressor) | Improvement |
| :--- | :---: | :---: | :---: |
| **Mean Absolute Error (MAE)** | 4.02% | **2.78%** | **-30.8% Error** |
| **Root Mean Squared Error (RMSE)** | 5.29% | **4.13%** | **-21.9% Error** |
| **Coefficient of Determination ($R^2$)** | 0.733 | **0.837** | **+14.2% Variance** |
| **Median Absolute Error (MedAE)** | 3.11% | **1.92%** | **-38.3% Error** |

---

## 5. Explainable AI (XAI) & SHAP Explainability

To satisfy the transparency requirements of central government audit committees, Project Sentinel integrates **TreeSHAP** (`shap.TreeExplainer`) into both global model telemetry and instance-level project evaluations.

### 5.1 Global Feature Importances
| Feature Name | Category | Normalized SHAP Importance |
| :--- | :--- | :---: |
| **Timeline Revision (Months)** | Schedule Drift | **30.2%** |
| **Progress Gap (Disbursement vs Physical)** | Execution Divergence | **16.3%** |
| **Historical Cost Escalation %** | Financial Momentum | **13.8%** |
| **Physical Progress Velocity** | Milestone Velocity | **13.5%** |
| **Physical Progress %** | Milestone Velocity | **6.2%** |
| **Sector Risk Weight** | Domain Sector | **4.6%** |
| **Remaining Work Scope** | Milestone Velocity | **4.5%** |
| **Sanctioned Baseline Cost** | Project Scale | **2.1%** |
| **Disbursement Burn Rate** | Disbursement Outlay | **1.7%** |
| **Contracting Mechanism Risk** | Procurement Risk | **1.7%** |
| **Cumulative Expenditure** | Project Scale | **1.2%** |
| **Cost Growth (₹ Cr)** | Budget Escalation | **1.1%** |
| **Project Age (Months Active)** | Longevity Drift | **1.0%** |
| **Financial Progress %** | Disbursement Outlay | **0.8%** |
| **Terrain Topography Complexity** | Topographical Risk | **0.7%** |
| **Approved Revised Cost** | Project Scale | **0.6%** |

### 5.2 Local Feature Attribution (Instance-Level)
For every project evaluated in the dashboard, the inference engine tracks the exact decision branches taken through all 180 delay trees and 220 cost trees, decomposing the prediction into actionable plain-English drivers:
- *"Progress gap of +34% (Disbursement 76% vs Physical 42%) elevates risk."*
- *"Sanctioned cost has escalated by +28% (₹700 Cr revised upward)."*
- *"Scheduled completion target pushed back by +18 months."*

---

## 6. Serverless Production Serving Architecture

```
                       [React + Vite Frontend]
                                 │
                                 ▼
                     [Netlify Serverless Function]
                                 │
                           (Express App)
                                 │
                     ┌───────────┴───────────┐
                     ▼                       ▼
            [Supabase Database]      [mlModelService.ts]
         (Projects, Monitoring)              │
                                     (Portable JSON Trees)
                                     (Zero-Dependency Engine)
                                             │
                             ┌───────────────┴───────────────┐
                             ▼                               ▼
                     [Delay Classifier]              [Cost Regressor]
                     (180 XGBoost Trees)           (220 XGBoost Trees)
                             │                               │
                             └───────────────┬───────────────┘
                                             ▼
                               [TreeSHAP Local Attributions]
                                             │
                                             ▼
                                [Composite Risk Gauge 0-100]
                                             │
                                             ▼
                                 [public.project_predictions]
                                 [public.alerts]
```

### Why Native JSON Tree Traversal?
- **Zero Heavy C++ Binaries**: Avoids `onnxruntime-node` binary incompatibilities on AWS Lambda / Netlify Serverless environments.
- **Microsecond Latency**: Pure TypeScript tree evaluation executes in **<0.8ms** per project.
- **Exact Floating-Point Parity**: Validated to within $10^{-8}$ of native C++ XGBoost predictions.
- **100% Serverless Safe**: Packaged inside the Netlify function bundle via `included_files = ["server/ml/artifacts/**"]`.

---

## 7. Migration Guide: Connecting Real MoSPI / PAIMANA Data

When central ministry access to internal PAIMANA databases is provisioned:

1. **Export Telemetry**:
   Export historical milestone records to CSV or Parquet matching the schema defined in `data/sih_infra_training_dataset.csv`.
2. **Execute Retraining**:
   ```bash
   python scripts/train_models.py
   ```
3. **Verify Evaluation Metrics**:
   Inspect `server/ml/artifacts/v1.0/model_metrics.json` to confirm updated test set performance.
4. **Deploy**:
   ```bash
   npm run build
   git commit -am "chore(ml): update models with live PAIMANA training batch"
   git push origin main
   ```
   Netlify automatically deploys the updated models with zero downtime and zero schema migrations.
