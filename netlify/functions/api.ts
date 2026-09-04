import serverless from 'serverless-http';
import { app } from '../../server/app';

// Serverless function handler wrapping Express app for Netlify
export const handler = serverless(app);
export default handler;
