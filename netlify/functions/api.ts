import serverless from 'serverless-http';
import { app } from '../../server';

// Serverless function handler wrapping Express app for Netlify
export const handler = serverless(app);
