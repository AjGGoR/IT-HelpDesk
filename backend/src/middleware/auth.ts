import type { RequestHandler } from 'express';
import jwt from 'jsonwebtoken';
import { UserRole } from '@prisma/client';

import { env } from '../config/env.js';
import { prisma } from '../config/prisma.js';
import { AppError } from '../utils/app-error.js';

type TokenPayload = { userId: string; role: UserRole };

export const signToken = (payload: TokenPayload) =>
  jwt.sign(payload, env.jwtSecret, { expiresIn: '8h' });

export const authenticate: RequestHandler = async (request, _response, next) => {
  const value = request.header('authorization');
  if (!value?.startsWith('Bearer '))
    return next(new AppError(401, 'UNAUTHENTICATED', 'Wymagane jest uwierzytelnienie.'));
  try {
    const payload = jwt.verify(value.slice(7), env.jwtSecret, {
      algorithms: ['HS256'],
    }) as TokenPayload;
    if (!payload.userId || !Object.values(UserRole).includes(payload.role))
      throw new Error('Invalid token');
    const user = await prisma.user.findUnique({ where: { id: payload.userId } });
    if (!user || !user.isActive)
      return next(
        new AppError(401, 'UNAUTHENTICATED', 'Sesja jest nieważna lub konto jest nieaktywne.'),
      );
    request.auth = { userId: user.id, role: user.role, email: user.email };
    next();
  } catch {
    next(
      new AppError(
        401,
        'UNAUTHENTICATED',
        'Token uwierzytelniający jest nieprawidłowy lub wygasł.',
      ),
    );
  }
};

export const requireRole =
  (...roles: UserRole[]): RequestHandler =>
  (request, _response, next) => {
    if (!request.auth)
      return next(new AppError(401, 'UNAUTHENTICATED', 'Wymagane jest uwierzytelnienie.'));
    if (!roles.includes(request.auth.role))
      return next(new AppError(403, 'FORBIDDEN', 'Brak wymaganych uprawnień.'));
    next();
  };
