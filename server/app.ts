import dotenv from 'dotenv';
dotenv.config();
import express, { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import jwt from 'jsonwebtoken';
import { db } from './database/db';
import { chatWithPortfolio } from './ai/geminiService';
import {
  parseCSVData,
  parseExcelBuffer,
  validateProjectRecords,
} from './engine/dataValidation';
import { getModelInsights, runMLPredictions } from './engine/mlEngine';
import { calculateFeatures } from './engine/featureEngineering';
import { calculate_risk_score } from './engine/riskEngine';
import { ProjectMonitoringData, User, UserRole } from '../src/types';
import { createClient } from '@supabase/supabase-js';
import { supabaseAdmin, isSupabaseConfigured } from './database/supabaseClient';

const JWT_SECRET = process.env.JWT_SECRET || 'sentinel-secure-jwt-key-2026-hackathon';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB max
});

export interface AuthenticatedRequest extends Request {
  user?: User;
}

// User extraction helper: supports Supabase JWT sessions & fallback tokens
export async function getAuthUserFromRequest(req: Request): Promise<User | null> {
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

        let role = (profile?.role as UserRole) || 'officer';
        let name = profile?.name || sbUser.user_metadata?.name || sbUser.email?.split('@')[0] || 'User';

        if (!profile && sbUser.email) {
          // Backfill profile row if user was created before schema trigger
          await supabaseAdmin.from('profiles').upsert({
            id: sbUser.id,
            email: sbUser.email,
            name,
            role,
          });
        }

        return {
          id: sbUser.id,
          name,
          email: sbUser.email || '',
          role,
          created_at: sbUser.created_at,
        };
      }
    } catch {
      // Fall through to fallback token check
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

export function createExpressApp() {
  const app = express();

  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Normalize Netlify function path prefix if present
  app.use((req, res, next) => {
    if (req.url.startsWith('/.netlify/functions/api')) {
      const trimmed = req.url.replace('/.netlify/functions/api', '');
      req.url = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
      if (req.url === '//') req.url = '/';
    }
    next();
  });

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

  // ==========================================
  // HEALTH CHECK
  // ==========================================
  app.get(['/api/health', '/health'], (req, res) => {
    res.json({
      status: 'ok',
      service: 'Project Sentinel AI',
      database: isSupabaseConfigured ? 'Supabase PostgreSQL' : 'Local Standalone',
      timestamp: new Date().toISOString(),
    });
  });

  // ==========================================
  // AUTHENTICATION ENDPOINTS
  // ==========================================

  // GET /api/auth/me - Verify current session token and return authoritative user & role
  const handleAuthMe = async (req: Request, res: Response) => {
    try {
      const user = await getAuthUserFromRequest(req);
      if (!user) {
        return res.status(401).json({
          error: 'Session expired or invalid. Please log in again.',
          code: 'UNAUTHORIZED',
        });
      }
      return res.json({ user });
    } catch (err: any) {
      return res.status(500).json({ error: err.message, code: 'AUTH_ERROR' });
    }
  };
  app.get('/api/auth/me', handleAuthMe);
  app.get('/auth/me', handleAuthMe);

  // POST /api/auth/demo-login - Authenticates demo account without client-side credentials
  const handleDemoLogin = async (req: Request, res: Response) => {
    try {
      const demoEmail = process.env.DEMO_EMAIL || process.env.DEMO_USER_EMAIL || 'demo@projectsentinel.ai';
      const demoPassword = process.env.DEMO_PASSWORD || process.env.DEMO_USER_PASSWORD || 'DemoSentinel2026!';

      if (isSupabaseConfigured) {
        const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
        const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';

        // Use an isolated auth client so supabaseAdmin's service-role session is NEVER mutated
        const authClient = createClient(supabaseUrl, supabaseAnonKey, {
          auth: {
            persistSession: false,
            autoRefreshToken: false,
          },
        });

        const { data, error } = await authClient.auth.signInWithPassword({
          email: demoEmail,
          password: demoPassword,
        });

        if (error || !data.session) {
          return res.status(401).json({
            error: error?.message || 'Failed to authenticate with demo account in Supabase. Please ensure the demo account is provisioned.',
            code: 'DEMO_AUTH_FAILED',
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

      // Standalone mode when Supabase is not configured
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
      res.status(500).json({ error: err.message, code: 'INTERNAL_ERROR' });
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
      res.status(500).json({ error: err.message, code: 'DATABASE_ERROR' });
    }
  });

  // PATCH /api/admin/users/:user_id/role - Update a user's role (admin/officer)
  app.patch('/api/admin/users/:user_id/role', requireAdmin as any, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { user_id } = req.params;
      const { role } = req.body;

      if (!['admin', 'officer'].includes(role)) {
        return res.status(400).json({ error: "Invalid role. Role must be 'admin' or 'officer'." });
      }

      if (req.user?.id === user_id && role !== 'admin') {
        return res.status(400).json({ error: 'Admins cannot demote their own account to prevent lockout.' });
      }

      if (isSupabaseConfigured) {
        const { data, error } = await supabaseAdmin
          .from('profiles')
          .update({ role, updated_at: new Date().toISOString() })
          .eq('id', user_id)
          .select('id, email, name, role, created_at')
          .single();

        if (error) throw new Error(error.message);
        return res.json({ success: true, user: data });
      }

      return res.json({ success: true, message: 'Role updated in local memory' });
    } catch (err: any) {
      res.status(500).json({ error: err.message, code: 'DATABASE_ERROR' });
    }
  });

  // ==========================================
  // PROJECT PORTFOLIO & DETAIL ENDPOINTS
  // ==========================================

  // 1. GET /projects
  registerRoute('get', '/projects', async (req, res) => {
    try {
      const user = await getAuthUserFromRequest(req);
      const projects = await db.getAllProjects(user || undefined);
      res.json(projects);
    } catch (err: any) {
      console.error('[GET /projects Error]:', err.message);
      res.status(500).json({ error: err.message || 'Failed to fetch projects', code: 'DATABASE_ERROR' });
    }
  });

  // 2. GET /projects/:id
  const handleGetProjectById = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const user = await getAuthUserFromRequest(req);
      const data = await db.getProjectById(id, user || undefined);

      if (!data) {
        return res.status(404).json({ error: `Project not found with ID: ${id}` });
      }

      res.json(data);
    } catch (err: any) {
      res.status(500).json({ error: err.message, code: 'DATABASE_ERROR' });
    }
  };
  app.get('/api/projects/:id', handleGetProjectById);
  app.get('/projects/:id', handleGetProjectById);

  // 3. POST /projects (Admin creates a project with optional officer assignment)
  const handleCreateProject = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const {
        project_code,
        project_name,
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
      } = req.body;

      if (!project_code || !project_name || !sector || !ministry || !implementing_agency || !state) {
        return res.status(400).json({ error: 'Missing required project metadata fields.' });
      }

      const newProject = await db.createProject({
        project_code,
        project_name,
        sector,
        ministry,
        implementing_agency,
        state,
        original_cost: Number(original_cost || 0),
        revised_cost: Number(revised_cost || original_cost || 0),
        expenditure: Number(expenditure || 0),
        physical_progress: Number(physical_progress || 0),
        original_completion_date: original_completion_date || '2027-12-31',
        revised_completion_date: revised_completion_date || original_completion_date || '2027-12-31',
        assigned_to: assigned_to || undefined,
      });

      return res.status(201).json({ success: true, project: newProject });
    } catch (err: any) {
      console.error('[POST /projects Error]:', err.message);
      res.status(500).json({ error: err.message || 'Failed to create project', code: 'DATABASE_ERROR' });
    }
  };
  app.post('/api/projects', requireAdmin as any, handleCreateProject as any);
  app.post('/projects', requireAdmin as any, handleCreateProject as any);

  // 3b. PATCH /projects/:id (Admin only: update project metadata & officer assignment)
  const handleUpdateProject = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;
      const updates = req.body;
      const updated = await db.updateProject(id, updates);
      if (!updated) {
        return res.status(404).json({ error: `Project not found with ID: ${id}` });
      }
      return res.json({ success: true, project: updated });
    } catch (err: any) {
      console.error('[PATCH /projects/:id Error]:', err.message);
      res.status(500).json({ error: err.message || 'Failed to update project', code: 'DATABASE_ERROR' });
    }
  };
  app.patch('/api/projects/:id', requireAdmin as any, handleUpdateProject as any);
  app.patch('/projects/:id', requireAdmin as any, handleUpdateProject as any);

  // 4. GET /dashboard
  registerRoute('get', '/dashboard', async (req, res) => {
    try {
      const user = await getAuthUserFromRequest(req);
      const summary = await db.getDashboardSummary(user || undefined);
      res.json(summary);
    } catch (err: any) {
      console.error('[GET /dashboard Error]:', err.message);
      res.status(500).json({ error: err.message || 'Failed to fetch dashboard summary', code: 'DATABASE_ERROR' });
    }
  });

  // 5. GET /alerts
  registerRoute('get', '/alerts', async (req, res) => {
    try {
      const { status } = req.query;
      const user = await getAuthUserFromRequest(req);
      const alerts = await db.getAllAlerts(status as string | undefined, user || undefined);
      res.json(alerts);
    } catch (err: any) {
      res.status(500).json({ error: err.message, code: 'DATABASE_ERROR' });
    }
  });

  // 6. PATCH /alerts/:id
  const handleUpdateAlert = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { status } = req.body;

      if (!status || !['NEW', 'REVIEWED', 'RESOLVED'].includes(status)) {
        return res.status(400).json({ error: "Invalid status. Must be 'NEW', 'REVIEWED', or 'RESOLVED'." });
      }

      const updated = await db.updateAlertStatus(id, status);
      if (!updated) {
        return res.status(404).json({ error: `Alert not found with ID: ${id}` });
      }

      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ error: err.message, code: 'DATABASE_ERROR' });
    }
  };
  app.patch('/api/alerts/:id', requireAdmin as any, handleUpdateAlert);
  app.patch('/alerts/:id', requireAdmin as any, handleUpdateAlert);

  // 7. POST /upload-data
  const handleDataUpload = async (req: Request, res: Response) => {
    try {
      const isCommit = req.query.commit === 'true';
      const dataSource = (req.body.data_source || 'MoSPI Benchmark').trim();
      const isFile = (req as any).file;
      const jsonBody = req.body;

      let rawRows: any[] = [];

      if (isFile) {
        const fileExt = isFile.originalname.split('.').pop()?.toLowerCase();
        if (fileExt === 'csv') {
          const csvString = isFile.buffer.toString('utf-8');
          rawRows = parseCSVData(csvString);
        } else if (fileExt === 'xlsx' || fileExt === 'xls') {
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

        const importStats = await db.importRecords(validRowsToImport);

        return res.json({
          success: true,
          message: `Successfully imported ${importStats.imported_count} new projects and updated ${importStats.updated_count} projects.`,
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
      res.status(500).json({ error: err.message, code: 'IMPORT_ERROR' });
    }
  };
  app.post('/api/upload-data', requireAdmin as any, upload.single('file'), handleDataUpload);
  app.post('/upload-data', requireAdmin as any, upload.single('file'), handleDataUpload);

  // 8. GET /analytics
  registerRoute('get', '/analytics', async (req, res) => {
    try {
      const user = await getAuthUserFromRequest(req);
      const summary = await db.getDashboardSummary(user || undefined);
      const insights = getModelInsights();
      res.json({
        summary,
        insights,
        system_status: {
          database: isSupabaseConfigured ? 'Supabase PostgreSQL' : 'Local Standalone',
          ml_engine: 'XGBoost & TreeSHAP Production Engine Active (v1.0)',
          risk_engine: 'Hybrid 4-Vector Risk Engine Active',
          data_pipeline: 'MoSPI/PAIMANA Compliant',
        },
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message, code: 'DATABASE_ERROR' });
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

  // 10. POST /predict/simulate (MUST be registered before /predict/:project_id wildcard)
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

  // 11. POST /predict/:project_id
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
      res.status(500).json({ error: err.message, code: 'DATABASE_ERROR' });
    }
  };
  app.post('/api/predict/:project_id', handlePredict);
  app.post('/predict/:project_id', handlePredict);

  // 12. POST /api/chat and POST /chat
  const handleChat = async (req: Request, res: Response) => {
    try {
      const { message, history = [], currentProjectId } = req.body;
      if (!message || typeof message !== 'string' || !message.trim()) {
        return res.status(400).json({ error: 'Message is required and cannot be empty.' });
      }

      const user = await getAuthUserFromRequest(req);
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

  // ==========================================
  // API 404 CATCH-ALL (Never returns HTML for /api/*)
  // ==========================================
  app.use('/api', (req: Request, res: Response) => {
    res.status(404).json({
      error: `API route not found: ${req.method} ${req.originalUrl}`,
      code: 'NOT_FOUND',
    });
  });

  return app;
}

export const app = createExpressApp();
