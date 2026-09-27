import cors from 'cors';
import express from 'express';
import helmet from 'helmet';

import { env } from './config/env.js';
import { errorHandler } from './middleware/error-handler.js';
import { healthRouter } from './routes/health.routes.js';
import { authRouter, dashboardRouter, ticketRouter, userRouter } from './routes/api.routes.js';

export const app = express();

// The app is always deployed behind exactly one reverse-proxy hop (the `frontend`
// nginx container in docker-compose.yml), which sets X-Forwarded-For. A numeric hop
// count (rather than `true`) tells Express/express-rate-limit to trust only that one
// hop, so a client cannot spoof additional X-Forwarded-For entries to impersonate a
// different IP and evade per-IP rate limiting.
app.set('trust proxy', 1);

app.disable('x-powered-by');
app.use(helmet());
app.use(cors({ origin: env.frontendUrl }));
app.use(express.json({ limit: '1mb' }));

app.use('/api/health', healthRouter);
app.use('/api/auth', authRouter);
app.use('/api/tickets', ticketRouter);
app.use('/api/users', userRouter);
app.use('/api/dashboard', dashboardRouter);

app.use((_request, response) => {
  response.status(404).json({
    error: {
      code: 'NOT_FOUND',
      message: 'Nie znaleziono żądanego zasobu.',
    },
  });
});

app.use(errorHandler);
