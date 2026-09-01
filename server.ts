import express, { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import path from 'path';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { createServer as createViteServer } from 'vite';
import { db } from './server/database/db';
import {
  parseCSVData,
  parseExcelBuffer,
  validateProjectRecords,
} from './server/engine/dataValidation';
import { getModelInsights, runMLPredictions } from './server/engine/mlEngine';
import { calculateFeatures } from './server/engine/featureEngineering';
import { calculate_risk_score } from './server/engine/riskEngine';
import { ProjectMonitoringData, User, UserRole } from './src/types';

const JWT_SECRET = process.env.JWT_SECRET || 'sentinel-secure-jwt-key-2026-hackathon';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB max
});

interface AuthenticatedRequest extends Request {
  user?: User;
}

// Token helper
function generateToken(user: User): string {
  return jwt.sign(
    {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

// User extraction helper
function getAuthUserFromRequest(req: Request): User | null {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  const token = authHeader.substring(7).trim();
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    if (decoded && decoded.id) {
      const dbUser = db.findUserById(decoded.id);
      if (dbUser) {
        return {
          id: dbUser.id,
          name: dbUser.name,
          email: dbUser.email,
          role: dbUser.role,
          created_at: dbUser.created_at,
        };
      }
    }
    return null;
  } catch {
    return null;
  }
}

// Middleware: Require Authenticated User
function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const user = getAuthUserFromRequest(req);
  if (!user) {
    return res.status(401).json({
      error: 'Authentication required. Please log in with a valid session token.',
      code: 'UNAUTHORIZED',
    });
  }
  req.user = user;
  next();
}

// Middleware: Require Admin User
function requireAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const user = getAuthUserFromRequest(req);
  if (!user) {
    return res.status(401).json({
      error: 'Authentication required. Please log in as an Administrator.',
      code: 'UNAUTHORIZED',
    });
  }
  if (user.role !== 'admin') {
    return res.status(403).json({
      error: 'Access Denied: Admin role is required to upload or modify project data.',
      code: 'FORBIDDEN',
      current_role: user.role,
    });
  }
  req.user = user;
  next();
}

async function startServer() {
  const app = express();
  const PORT = 3000;

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
    res.json({ status: 'ok', service: 'Project Sentinel AI', timestamp: new Date().toISOString() });
  });

  // ==========================================
  // AUTHENTICATION & RBAC ENDPOINTS
  // ==========================================

  // POST /auth/login & POST /api/auth/login
  const handleLogin = (req: Request, res: Response) => {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
      }

      const user = db.findUserByEmail(email);
      if (!user) {
        return res.status(401).json({ error: 'Invalid email or password' });
      }

      const isValidPassword = bcrypt.compareSync(password, user.password_hash);
      if (!isValidPassword) {
        return res.status(401).json({ error: 'Invalid email or password' });
      }

      const safeUser: User = {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        created_at: user.created_at,
      };

      const access_token = generateToken(safeUser);

      return res.json({
        access_token,
        token_type: 'Bearer',
        user: safeUser,
        message: `Welcome back, ${safeUser.name}! Logged in as ${safeUser.role === 'admin' ? 'Administrator' : 'Monitoring Officer'}.`,
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  };
  app.post('/api/auth/login', handleLogin);
  app.post('/auth/login', handleLogin);

  // POST /auth/register & POST /api/auth/register
  const handleRegister = (req: Request, res: Response) => {
    try {
      const { name, email, password, role = 'officer' } = req.body;
      if (!name || !email || !password) {
        return res.status(400).json({ error: 'Name, email, and password are required' });
      }

      if (!['admin', 'officer'].includes(role)) {
        return res.status(400).json({ error: "Role must be either 'admin' or 'officer'" });
      }

      const existing = db.findUserByEmail(email);
      if (existing) {
        return res.status(409).json({ error: `User with email '${email}' already exists` });
      }

      const password_hash = bcrypt.hashSync(password, 10);
      const newUser = db.createUser({
        name,
        email,
        password_hash,
        role: role as UserRole,
      });

      const safeUser: User = {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
        created_at: newUser.created_at,
      };

      const access_token = generateToken(safeUser);

      return res.status(201).json({
        access_token,
        token_type: 'Bearer',
        user: safeUser,
        message: 'Account registered successfully.',
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  };
  app.post('/api/auth/register', handleRegister);
  app.post('/auth/register', handleRegister);

  // GET /auth/me & GET /api/auth/me
  const handleGetMe = (req: AuthenticatedRequest, res: Response) => {
    return res.json({
      user: req.user,
    });
  };
  app.get('/api/auth/me', requireAuth as any, handleGetMe as any);
  app.get('/auth/me', requireAuth as any, handleGetMe as any);

  // GET /auth/demo-accounts - Quick helper for hackathon inspection
  const handleGetDemoAccounts = (req: Request, res: Response) => {
    res.json({
      demo_accounts: [
        {
          role: 'admin',
          name: 'Administrator',
          email: 'admin@projectsentinel.ai',
          password_hint: 'Admin123',
          description: 'Full permissions: upload data, modify projects, resolve alerts, run AI models',
        },
        {
          role: 'officer',
          name: 'Monitoring Officer',
          email: 'officer@projectsentinel.ai',
          password_hint: 'Officer123',
          description: 'Read-only monitoring: view dashboards, risk scores, AI alerts, and projects',
        },
      ],
    });
  };
  app.get('/api/auth/demo-accounts', handleGetDemoAccounts);
  app.get('/auth/demo-accounts', handleGetDemoAccounts);

  // 1. GET /dashboard
  registerRoute('get', '/dashboard', (req, res) => {
    try {
      const summary = db.getDashboardSummary();
      res.json(summary);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 2. GET /projects
  registerRoute('get', '/projects', (req, res) => {
    try {
      const projects = db.getAllProjects();
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
        // default by risk score desc
        filtered.sort((a, b) => (b.prediction?.risk_score ?? 0) - (a.prediction?.risk_score ?? 0));
      }

      res.json(filtered);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 3. GET /projects/:project_id
  registerRoute('get', '/projects/:project_id', (req, res) => {
    try {
      const { project_id } = req.params;
      const data = db.getProjectById(project_id);
      if (!data) {
        return res.status(404).json({ error: `Project not found with ID: ${project_id}` });
      }
      res.json(data);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 4. GET /alerts
  registerRoute('get', '/alerts', (req, res) => {
    try {
      const alerts = db.getAllAlerts();
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

  // 5. PATCH /alerts/:alert_id
  const handleAlertPatch = (req: Request, res: Response) => {
    try {
      const { alert_id } = req.params;
      const { status } = req.body;
      if (!status || !['NEW', 'REVIEWED', 'RESOLVED'].includes(status)) {
        return res.status(400).json({ error: 'Valid status required: NEW, REVIEWED, or RESOLVED' });
      }

      const updated = db.updateAlertStatus(alert_id, status);
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

  // 6. POST /upload-data (Validate, preview, or commit import) - ADMIN ONLY
  const handleDataUpload = (req: Request, res: Response) => {
    try {
      const isFile = req.file;
      const jsonBody = req.body;
      let rawRows: any[] = [];
      const isCommit = req.query.commit === 'true' || jsonBody.commit === true;
      const dataSource = (req.body?.data_source as string) || 'Imported Data';

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

      // Attach data_source tag
      rawRows = rawRows.map((r) => ({ ...r, data_source: dataSource }));

      // Run Validation Engine
      const validation = validateProjectRecords(rawRows);

      if (isCommit) {
        if (validation.valid_rows === 0) {
          return res.status(400).json({
            error: 'No valid records to import. Please review validation errors.',
            validation,
          });
        }

        // Commit valid records to database
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

        const importStats = db.importRecords(validRowsToImport);

        return res.json({
          success: true,
          message: `Successfully imported ${importStats.imported_count} new projects and updated ${importStats.updated_count} projects with recalculations.`,
          import_stats: importStats,
          validation,
        });
      }

      // Return validation preview
      return res.json({
        success: true,
        preview_mode: true,
        validation,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  };

  app.post('/api/upload-data', requireAdmin as any, upload.single('file'), handleDataUpload);
  app.post('/upload-data', requireAdmin as any, upload.single('file'), handleDataUpload);

  // 7. GET /analytics
  registerRoute('get', '/analytics', (req, res) => {
    try {
      const summary = db.getDashboardSummary();
      const insights = getModelInsights();
      res.json({
        summary,
        insights,
        system_status: {
          database: 'PostgreSQL Operational',
          ml_engine: 'Random Forest Ensemble v2.4 Active',
          risk_engine: 'Hybrid 4-Vector Risk Engine Active',
          data_pipeline: 'MoSPI/PAIMANA Compliant',
        },
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 8. GET /model-insights
  registerRoute('get', '/model-insights', (req, res) => {
    try {
      const insights = getModelInsights();
      res.json(insights);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 9. POST /predict/:project_id (Run/Recalculate AI Prediction)
  const handlePredict = (req: Request, res: Response) => {
    try {
      const { project_id } = req.params;
      const updatedProject = db.recalculateProject(project_id);
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

  // 10. POST /predict/simulate (Interactive ML scenario simulator)
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

  // Vite middleware setup
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
  });
}

startServer();
