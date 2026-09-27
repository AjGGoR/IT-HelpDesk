import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { authenticate, requireRole } from '../middleware/auth.js';
import { asyncHandler } from '../utils/async-handler.js';
import * as c from '../controllers/api.controllers.js';
import { UserRole } from '@prisma/client';

export const authRouter = Router();
authRouter.post(
  '/login',
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      error: { code: 'TOO_MANY_REQUESTS', message: 'Zbyt wiele prób logowania. Spróbuj później.' },
    },
  }),
  asyncHandler(c.login),
);
authRouter.get('/me', authenticate, asyncHandler(c.me));
export const ticketRouter = Router();
ticketRouter.use(authenticate);
ticketRouter.get('/', asyncHandler(c.listTickets));
ticketRouter.post('/', asyncHandler(c.createTicket));
ticketRouter.get('/:id', asyncHandler(c.getTicket));
ticketRouter.patch('/:id', asyncHandler(c.patchTicket));
ticketRouter.post(
  '/:id/assign',
  requireRole(UserRole.TECHNICIAN, UserRole.ADMIN),
  asyncHandler(c.assignTicket),
);
ticketRouter.get('/:id/comments', asyncHandler(c.comments));
ticketRouter.post('/:id/comments', asyncHandler(c.addComment));
ticketRouter.get('/:id/history', asyncHandler(c.history));
ticketRouter.post(
  '/:id/resolve',
  requireRole(UserRole.TECHNICIAN, UserRole.ADMIN),
  asyncHandler(c.resolveTicket),
);
ticketRouter.post('/:id/close', asyncHandler(c.closeTicket));
export const userRouter = Router();
userRouter.use(authenticate, requireRole(UserRole.ADMIN));
userRouter.get('/', asyncHandler(c.listUsers));
userRouter.post('/', asyncHandler(c.createUser));
userRouter.patch('/:id', asyncHandler(c.patchUser));
userRouter.patch('/:id/role', asyncHandler(c.changeRole));
userRouter.patch('/:id/status', asyncHandler(c.changeStatus));
export const dashboardRouter = Router();
dashboardRouter.use(authenticate);
dashboardRouter.get('/', asyncHandler(c.dashboard));
