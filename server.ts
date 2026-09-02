import dotenv from 'dotenv';
dotenv.config();
import path from 'path';
import express from 'express';
import { createServer as createViteServer } from 'vite';
import { createExpressApp } from './server/app';

async function startServer() {
  const app = createExpressApp();
  const PORT = 3000;

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
    const key = (process.env.API_KEY || process.env.GEMINI_API_KEY || process.env.OPENROUTER_API_KEY)?.trim();
    if (key && !key.startsWith('MY_') && !key.startsWith('YOUR_')) {
      console.log(`[AI Service] Initialized with API key (${key.substring(0, 6)}... configured)`);
    } else {
      console.warn(`[AI Service] WARNING: API_KEY is not set or using placeholder in .env`);
    }
  });
}

startServer();
