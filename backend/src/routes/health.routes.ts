import { Router } from 'express';

import { prisma } from '../config/prisma.js';

export const healthRouter = Router();

healthRouter.get('/', async (_request, response) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    response.status(200).json({
      status: 'ok',
      service: 'helpdesk-api',
      database: 'ok',
      timestamp: new Date().toISOString(),
    });
  } catch {
    response.status(503).json({
      status: 'degraded',
      service: 'helpdesk-api',
      database: 'unavailable',
    });
  }
});
