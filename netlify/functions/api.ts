import serverless from 'serverless-http';
import { createExpressApp } from '../../server/app';

const app = createExpressApp();

export const handler = serverless(app);
