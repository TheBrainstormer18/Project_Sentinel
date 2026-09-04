import dotenv from 'dotenv';
dotenv.config();
import express from 'express';
import path from 'path';
import { app } from './server/app';

async function startServer() {
  const PORT = Number(process.env.PORT) || 3000;

  if (process.env.NODE_ENV !== 'production') {
    // Dynamically import Vite only in local development
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Production standalone mode: serve pre-built static files from dist
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Project Sentinel AI Server running on port ${PORT}`);
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

export { app };
