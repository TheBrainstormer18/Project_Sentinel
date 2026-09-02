import dotenv from 'dotenv';
dotenv.config();
import express, { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import path from 'path';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { createServer as createViteServer } from 'vite';
import { db } from './server/database/db';
import { chatWithPortfolio } from './server/ai/geminiService';
import {
  parseCSVData,
  parseExcelBuffer,
  validateProjectRecords,
} from './server/engine/dataValidation';
import { getModelInsights, runMLPredictions } from './server/engine/mlEngine';
import { calculateFeatures } from './server/engine/featureEngineering';
import { calculate_risk_score } from './server/engine/riskEngine';
import { ProjectMonitoringData, User, UserRole } from './src/types';
import { supabaseAdmin, isSupabaseConfigured } from './server/database/supabaseClient';

const JWT_SECRET = process.env.JWT_SECRET || 'sentinel-secure-jwt-key-2026-hackathon';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB max
});

export interface AuthenticatedRequest extends Request {
  user?: User;
}

// User extraction helper: supports Supabase JWT sessions & fallback tokens
async function getAuthUserFromRequest(req: Request): Promise<User | null> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  const token = authHeader.substring(7).trim();

  // 1. Check with Supabase Auth if configured
  if (isSupabaseConfigured) {
    try {
      const { data: { user: sbUser }, error } = await supabaseAdmin.auth.getUser(token);
      if (!error && sbUser) {
        // Fetch role from profiles table (enforcing database-managed roles)
        const { data: profile } = await supabaseAdmin
          .from('profiles')
          .select('role, name, email')
          .eq('id', sbUser.id)
          .maybeSingle();

        const role = (profile?.role as UserRole) || 'officer';
        const name = profile?.name || sbUser.user_metadata?.name || sbUser.email?.split('@')[0] || 'User';

        return {
          id: sbUser.id,
          name,
          email: sbUser.email || '',
          role,
          created_at: sbUser.created_at,
        };
      }
    } catch (sbErr) {
      // Fall through to local fallback token check
    }
  }

  // 2. Fallback JWT token decode for local dev
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    if (decoded && decoded.id) {
      return {
        id: decoded.id,
        name: decoded.name || 'User',
        email: decoded.email || '',
        role: decoded.role || 'officer',
        created_at: new Date().toISOString(),
      };
    }
    return null;
  } catch {
    return null;
  }
}

// Middleware: Require Authenticated User
export async function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const user = await getAuthUserFromRequest(req);
  if (!user) {
    return res.status(401).json({
      error: 'Authentication required. Please log in with a valid session token.',
      code: 'UNAUTHORIZED',
    });
  }
  req.user = user;
  next();
}

// Middleware: Require Admin User (Server-Side Authorization Enforced)
export async function requireAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const user = await getAuthUserFromRequest(req);
  if (!user) {
    return res.status(401).json({
      error: 'Authentication required. Please log in as an Administrator.',
      code: 'UNAUTHORIZED',
    });
  }
  if (user.role !== 'admin') {
    return res.status(403).json({
      error: 'Access Denied: Administrator role is required to access this resource.',
      code: 'FORBIDDEN',
      current_role: user.role,
    });
  }
  req.user = user;
  next();
}

export const app = express();

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Helper to register both /api/path and /path
function registerRoute(
  method: 'get' | 'post' | 'patch',
  routePath: string,
  handler: (req: Request, res: Response) => any
) {
  const apiPath = routePath.startsWith('/api') ? routePath : `/api${routePath}`;
  const directPath = routePath.startsWith('/api') ? routePath.replace('/api', '') : routePath;

  app[method](apiPath, handler);
  if (directPath && directPath !== '') {
    app[method](directPath, handler);
  }
}

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'Project Sentinel AI',
    database: isSupabaseConfigured ? 'Supabase PostgreSQL' : 'In-Memory Fallback',
    timestamp: new Date().toISOString(),
  });
});

// ==========================================
// SERVER-SIDE DEMO AUTHENTICATION
// ==========================================

// POST /api/auth/demo-login - Authenticates demo account without client-side credentials
const handleDemoLogin = async (req: Request, res: Response) => {
  try {
    const demoEmail = process.env.DEMO_EMAIL || process.env.DEMO_USER_EMAIL || 'demo@projectsentinel.ai';
    const demoPassword = process.env.DEMO_PASSWORD || process.env.DEMO_USER_PASSWORD || 'DemoSentinel2026!';

    if (isSupabaseConfigured) {
      const { data, error } = await supabaseAdmin.auth.signInWithPassword({
        email: demoEmail,
        password: demoPassword,
      });

      if (error || !data.session) {
        return res.status(401).json({
          error: error?.message || 'Failed to authenticate with demo account in Supabase. Please ensure the demo account is provisioned.',
        });
      }

      // Fetch user profile from database
      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('role, name')
        .eq('id', data.user.id)
        .maybeSingle();

      return res.json({
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        token_type: 'Bearer',
        user: {
          id: data.user.id,
          name: profile?.name || 'Demo Officer',
          email: data.user.email || demoEmail,
          role: profile?.role || 'officer',
          created_at: data.user.created_at,
        },
      });
    }

    // Fallback mode for local development before Supabase keys are configured
    return res.json({
      access_token: 'demo-local-fallback-token',
      refresh_token: 'demo-local-fallback-refresh',
      token_type: 'Bearer',
      user: {
        id: 'usr-demo-fallback',
        name: 'Demo Officer',
        email: demoEmail,
        role: 'officer',
        created_at: new Date().toISOString(),
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};
app.post('/api/auth/demo-login', handleDemoLogin);
app.post('/auth/demo-login', handleDemoLogin);

// ==========================================
// USER MANAGEMENT & RBAC ENDPOINTS (ADMIN ONLY)
// ==========================================

// GET /api/admin/users - List all registered users
app.get('/api/admin/users', requireAdmin as any, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (isSupabaseConfigured) {
      const { data, error } = await supabaseAdmin
        .from('profiles')
        .select('id, email, name, role, created_at')
        .order('created_at', { ascending: false });

      if (error) throw new Error(error.message);
      return res.json(data || []);
    }
    return res.json([]);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/admin/users/:user_id/role - Promote/demote a user
app.patch('/api/admin/users/:user_id/role', requireAdmin as any, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { user_id } = req.params;
    const { role } = req.body;

    if (!['admin', 'officer'].includes(role)) {
      return res.status(400).json({ error: "Role must be either 'admin' or 'officer'" });
    }

    if (isSupabaseConfigured) {
      const { data, error } = await supabaseAdmin
        .from('profiles')
        .update({ role, updated_at: new Date().toISOString() })
        .eq('id', user_id)
        .select('id, email, name, role, created_at')
        .single();

      if (error) throw new Error(error.message);
      return res.json(data);
    }

    return res.json({ id: user_id, role });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// CORE PROJECT & RISK ENDPOINTS
// ==========================================

// 1. GET /dashboard
registerRoute('get', '/dashboard', async (req: Request, res: Response) => {
  try {
    const user = await getAuthUserFromRequest(req);
    const summary = await db.getDashboardSummary(user || undefined);
    res.json(summary);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 2. GET /projects
registerRoute('get', '/projects', async (req: Request, res: Response) => {
  try {
    const user = await getAuthUserFromRequest(req);
    const projects = await db.getAllProjects(user || undefined);
    const { sector, risk_level, data_source, search, sort_by } = req.query;

    let filtered = [...projects];

    if (sector && typeof sector === 'string' && sector !== 'ALL') {
      filtered = filtered.filter((p) => p.sector.toLowerCase() === sector.toLowerCase());
    }
    if (risk_level && typeof risk_level === 'string' && risk_level !== 'ALL') {
      filtered = filtered.filter((p) => p.prediction?.risk_level === risk_level);
    }
    if (data_source && typeof data_source === 'string' && data_source !== 'ALL') {
      filtered = filtered.filter((p) => p.data_source === data_source);
    }
    if (search && typeof search === 'string') {
      const q = search.toLowerCase();
      filtered = filtered.filter(
        (p) =>
          p.project_name.toLowerCase().includes(q) ||
          p.project_code.toLowerCase().includes(q) ||
          p.implementing_agency.toLowerCase().includes(q) ||
          p.state.toLowerCase().includes(q) ||
          p.ministry.toLowerCase().includes(q)
      );
    }

    // Sorting
    if (sort_by === 'risk_desc') {
      filtered.sort((a, b) => (b.prediction?.risk_score ?? 0) - (a.prediction?.risk_score ?? 0));
    } else if (sort_by === 'risk_asc') {
      filtered.sort((a, b) => (a.prediction?.risk_score ?? 0) - (b.prediction?.risk_score ?? 0));
    } else if (sort_by === 'cost_desc') {
      filtered.sort(
        (a, b) => (b.latest_monitoring?.revised_cost ?? 0) - (a.latest_monitoring?.revised_cost ?? 0)
      );
    } else if (sort_by === 'progress_asc') {
      filtered.sort(
        (a, b) => (a.latest_monitoring?.physical_progress ?? 0) - (b.latest_monitoring?.physical_progress ?? 0)
      );
    } else {
      filtered.sort((a, b) => (b.prediction?.risk_score ?? 0) - (a.prediction?.risk_score ?? 0));
    }

    res.json(filtered);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 3. POST /projects - Create & Assign a Project (Admin only)
app.post('/api/projects', requireAdmin as any, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      project_name,
      project_code,
      sector,
      ministry,
      implementing_agency,
      state,
      original_cost,
      revised_cost,
      expenditure,
      physical_progress,
      original_completion_date,
      revised_completion_date,
      assigned_to,
      project_status,
    } = req.body;

    if (!project_name || !project_code || !sector) {
      return res.status(400).json({ error: 'Project name, project code, and sector are required.' });
    }

    const created = await db.createProject({
      project_name,
      project_code,
      sector,
      ministry: ministry || 'Ministry of Infrastructure',
      implementing_agency: implementing_agency || 'Nodal Agency',
      state: state || 'Multi-State',
      original_cost: Number(original_cost) || 100,
      revised_cost: Number(revised_cost) || Number(original_cost) || 100,
      expenditure: Number(expenditure) || 0,
      physical_progress: Number(physical_progress) || 0,
      original_completion_date: original_completion_date || '2026-12-31',
      revised_completion_date: revised_completion_date || '2026-12-31',
      assigned_to: assigned_to || null,
      project_status: project_status || 'On-Going',
    });

    res.status(201).json(created);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 4. GET /projects/:project_id
registerRoute('get', '/projects/:project_id', async (req: Request, res: Response) => {
  try {
    const { project_id } = req.params;
    const user = await getAuthUserFromRequest(req);
    const data = await db.getProjectById(project_id, user || undefined);
    if (!data) {
      return res.status(404).json({ error: `Project not found with ID: ${project_id}` });
    }
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 5. GET /alerts
registerRoute('get', '/alerts', async (req: Request, res: Response) => {
  try {
    const user = await getAuthUserFromRequest(req);
    const alerts = await db.getAllAlerts(user || undefined);
    const { severity, status, alert_type } = req.query;

    let filtered = [...alerts];
    if (severity && typeof severity === 'string' && severity !== 'ALL') {
      filtered = filtered.filter((a) => a.severity === severity);
    }
    if (status && typeof status === 'string' && status !== 'ALL') {
      filtered = filtered.filter((a) => a.status === status);
    }
    if (alert_type && typeof alert_type === 'string' && alert_type !== 'ALL') {
      filtered = filtered.filter((a) => a.alert_type === alert_type);
    }

    res.json(filtered);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 6. PATCH /alerts/:alert_id (Admin only)
const handleAlertPatch = async (req: Request, res: Response) => {
  try {
    const { alert_id } = req.params;
    const { status } = req.body;
    if (!status || !['NEW', 'REVIEWED', 'RESOLVED'].includes(status)) {
      return res.status(400).json({ error: 'Valid status required: NEW, REVIEWED, or RESOLVED' });
    }

    const updated = await db.updateAlertStatus(alert_id, status);
    if (!updated) {
      return res.status(404).json({ error: `Alert not found with ID: ${alert_id}` });
    }
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};
app.patch('/api/alerts/:alert_id', requireAdmin as any, handleAlertPatch);
app.patch('/alerts/:alert_id', requireAdmin as any, handleAlertPatch);

// 7. POST /upload-data (Validate, preview, or commit import) - ADMIN ONLY
const handleDataUpload = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const isFile = req.file;
    const jsonBody = req.body;
    let rawRows: any[] = [];
    const isCommit = req.query.commit === 'true' || jsonBody.commit === true;
    const dataSource = (req.body?.data_source as string) || 'Imported Data';
    const assignedTo = req.body?.assigned_to || null;

    if (isFile) {
      const ext = path.extname(isFile.originalname).toLowerCase();
      if (ext === '.csv') {
        const csvText = isFile.buffer.toString('utf-8');
        rawRows = parseCSVData(csvText);
      } else if (['.xlsx', '.xls'].includes(ext)) {
        rawRows = parseExcelBuffer(isFile.buffer);
      } else {
        return res.status(400).json({ error: 'Unsupported file format. Please upload .csv or .xlsx' });
      }
    } else if (jsonBody && Array.isArray(jsonBody.records)) {
      rawRows = jsonBody.records;
    } else if (jsonBody && typeof jsonBody.csv_text === 'string') {
      rawRows = parseCSVData(jsonBody.csv_text);
    } else {
      return res.status(400).json({ error: 'No file or valid data payload received.' });
    }

    rawRows = rawRows.map((r) => ({ ...r, data_source: dataSource }));
    const validation = validateProjectRecords(rawRows);

    if (isCommit) {
      if (validation.valid_rows === 0) {
        return res.status(400).json({
          error: 'No valid records to import. Please review validation errors.',
          validation,
        });
      }

      const validRowsToImport = rawRows
        .filter((_, idx) => {
          const hasRowError = validation.errors.some((e) => e.row === idx + 2);
          return !hasRowError;
        })
        .map((r) => ({
          project_code: String(r.project_code || r['Project Code']).trim(),
          project_name: String(r.project_name || r['Project Name']).trim(),
          sector: String(r.sector || r['Sector'] || 'Infrastructure').trim(),
          ministry: String(r.ministry || r['Ministry'] || 'Ministry of Infrastructure').trim(),
          implementing_agency: String(r.implementing_agency || r['Implementing Agency'] || 'Nodal Agency').trim(),
          state: String(r.state || r['State'] || 'Multi-State').trim(),
          project_status: r.project_status || r['Status'] || 'On-Going',
          update_date: r.update_date || new Date().toISOString().slice(0, 7),
          original_cost: Number(r.original_cost ?? r['Original Cost (Cr)'] ?? r['Original Cost'] ?? 0),
          revised_cost: Number(r.revised_cost ?? r['Revised Cost (Cr)'] ?? r['Revised Cost'] ?? 0),
          expenditure: Number(r.expenditure ?? r['Expenditure (Cr)'] ?? r['Expenditure'] ?? 0),
          physical_progress: Number(r.physical_progress ?? r['Physical Progress (%)'] ?? r['Physical Progress'] ?? 0),
          financial_progress: r.financial_progress !== undefined ? Number(r.financial_progress) : undefined,
          original_completion_date: String(r.original_completion_date || r['Original Completion Date'] || '2026-12-31').trim(),
          revised_completion_date: String(r.revised_completion_date || r['Revised Completion Date'] || '2026-12-31').trim(),
          data_source: dataSource,
        }));

      const importStats = await db.importRecords(validRowsToImport, assignedTo);

      return res.json({
        success: true,
        message: `Successfully imported ${importStats.imported_count} new projects and updated ${importStats.updated_count} projects with recalculations.`,
        import_stats: importStats,
        validation,
      });
    }

    return res.json({
      success: true,
      preview_mode: true,
      validation,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};
app.post('/api/upload-data', requireAdmin as any, upload.single('file'), handleDataUpload as any);
app.post('/upload-data', requireAdmin as any, upload.single('file'), handleDataUpload as any);

// 8. GET /analytics
registerRoute('get', '/analytics', async (req: Request, res: Response) => {
  try {
    const user = await getAuthUserFromRequest(req);
    const summary = await db.getDashboardSummary(user || undefined);
    const insights = getModelInsights();
    res.json({
      summary,
      insights,
      system_status: {
        database: isSupabaseConfigured ? 'Supabase PostgreSQL' : 'In-Memory Fallback',
        ml_engine: 'Random Forest Ensemble v2.4 Active',
        risk_engine: 'Hybrid 4-Vector Risk Engine Active',
        data_pipeline: 'MoSPI/PAIMANA Compliant',
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 9. GET /model-insights
registerRoute('get', '/model-insights', (req, res) => {
  try {
    const insights = getModelInsights();
    res.json(insights);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 10. POST /predict/:project_id (Recalculate AI Prediction)
const handlePredict = async (req: Request, res: Response) => {
  try {
    const { project_id } = req.params;
    const updatedProject = await db.recalculateProject(project_id);
    if (!updatedProject) {
      return res.status(404).json({ error: `Project not found with ID: ${project_id}` });
    }
    res.json({
      success: true,
      project: updatedProject,
      prediction: updatedProject.prediction,
      features: updatedProject.features,
      alerts: updatedProject.alerts,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};
app.post('/api/predict/:project_id', handlePredict);
app.post('/predict/:project_id', handlePredict);

// 11. POST /predict/simulate (Interactive ML scenario simulator)
const handleSimulate = (req: Request, res: Response) => {
  try {
    const {
      original_cost = 1000,
      revised_cost = 1200,
      expenditure = 800,
      physical_progress = 50,
      timeline_revision_months = 6,
      sector = 'Highways',
    } = req.body;

    const dummyMonitoring: ProjectMonitoringData = {
      id: 'sim-mon',
      project_id: 'sim-prj',
      update_date: '2026-06-01',
      original_cost: Number(original_cost),
      revised_cost: Number(revised_cost),
      expenditure: Number(expenditure),
      physical_progress: Number(physical_progress),
      financial_progress: Number(((Number(expenditure) / Math.max(0.1, Number(revised_cost))) * 100).toFixed(2)),
      original_completion_date: '2026-06-30',
      revised_completion_date: '2026-12-31',
    };

    const features = calculateFeatures(dummyMonitoring);
    features.timeline_revision_months = Number(timeline_revision_months);

    const simResult = calculate_risk_score(
      { id: 'sim-prj', project_code: 'SIM-001', project_name: 'Simulated Scenario', sector },
      dummyMonitoring,
      features
    );

    res.json({
      features,
      prediction: simResult.prediction,
      alerts: simResult.alerts,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};
app.post('/api/predict/simulate', handleSimulate);
app.post('/predict/simulate', handleSimulate);

// 12. POST /api/chat and POST /chat (AI Assistant with live Supabase context)
const handleChat = async (req: Request, res: Response) => {
  try {
    const { message, history = [], currentProjectId } = req.body;
    if (!message || typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({ error: 'Message is required and cannot be empty.' });
    }

    const user = await getAuthUserFromRequest(req);
    console.log(`[Chat Endpoint] User query: "${message.slice(0, 60)}" (history: ${history.length} turns, project: ${currentProjectId || 'portfolio'})`);
    const result = await chatWithPortfolio(message, history, currentProjectId, user || undefined);
    return res.json(result);
  } catch (err: any) {
    console.error('[Chat Endpoint Error]:', err.message || err);
    const isConfigError = String(err.message || '').includes('API_KEY is missing');
    return res.status(isConfigError ? 400 : 500).json({
      error: err.message || 'An error occurred while communicating with the AI service.',
      code: isConfigError ? 'MISSING_API_KEY' : 'AI_SERVICE_ERROR',
    });
  }
};
app.post('/api/chat', handleChat);
app.post('/chat', handleChat);

// Initialize dev server when running directly in local dev
async function startServer() {
  const PORT = Number(process.env.PORT) || 3000;

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Project Sentinel AI Full-Stack Server running on port ${PORT}`);
    const key = (process.env.OPENROUTER_API_KEY || process.env.API_KEY || process.env.GEMINI_API_KEY)?.trim();
    if (key && !key.startsWith('MY_') && !key.startsWith('YOUR_')) {
      console.log(`[AI Service] Initialized with API key (${key.substring(0, 6)}... configured)`);
    } else {
      console.warn(`[AI Service] WARNING: OPENROUTER_API_KEY is not set or using placeholder in .env`);
    }
  });
}

// Only start standalone HTTP server when executed directly, not when imported as serverless function
if (process.env.NETLIFY !== 'true' && process.env.AWS_LAMBDA_FUNCTION_NAME === undefined) {
  startServer();
}
