import type { RequestHandler } from 'express';
import bcrypt from 'bcrypt';
import { Prisma, UserRole } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../config/prisma.js';
import { signToken } from '../middleware/auth.js';
import { AppError } from '../utils/app-error.js';
import { publicUser } from '../utils/public-user.js';
import {
  accountStatusSchema,
  assignSchema,
  commentSchema,
  loginSchema,
  resolveSchema,
  roleSchema,
  ticketCreateSchema,
  ticketListSchema,
  ticketPatchSchema,
  userCreateSchema,
  userPatchSchema,
} from '../validators/api.js';
import * as tickets from '../services/ticket.service.js';
import { getDashboard } from '../services/dashboard.service.js';

const actor = (request: Parameters<RequestHandler>[0]) => {
  if (!request.auth) throw new AppError(401, 'UNAUTHENTICATED', 'Wymagane jest uwierzytelnienie.');
  return request.auth;
};
const id = (request: Parameters<RequestHandler>[0]) => {
  const value = request.params.id;
  const parsed = z.string().uuid().safeParse(value);
  if (!parsed.success)
    throw new AppError(422, 'INVALID_ID', 'Identyfikator musi być poprawnym UUID.');
  return parsed.data;
};
export const login: RequestHandler = async (request, response) => {
  const input = loginSchema.parse(request.body);
  const user = await prisma.user.findUnique({ where: { email: input.email.toLowerCase() } });
  if (!user || !user.isActive || !(await bcrypt.compare(input.password, user.passwordHash)))
    throw new AppError(401, 'INVALID_CREDENTIALS', 'Nieprawidłowy e-mail lub hasło.');
  response.json({ token: signToken({ userId: user.id, role: user.role }), user: publicUser(user) });
};
export const me: RequestHandler = async (request, response) => {
  const current = actor(request);
  const user = await prisma.user.findUnique({ where: { id: current.userId } });
  if (!user || !user.isActive) throw new AppError(401, 'UNAUTHENTICATED', 'Sesja jest nieważna.');
  response.json({ user: publicUser(user) });
};
export const listTickets: RequestHandler = async (req, res) => {
  res.json(await tickets.listTickets(actor(req), ticketListSchema.parse(req.query)));
};
export const createTicket: RequestHandler = async (req, res) => {
  res.status(201).json(await tickets.createTicket(actor(req), ticketCreateSchema.parse(req.body)));
};
export const getTicket: RequestHandler = async (req, res) => {
  res.json(await tickets.getTicket(id(req), actor(req)));
};
export const patchTicket: RequestHandler = async (req, res) => {
  res.json(await tickets.patchTicket(id(req), actor(req), ticketPatchSchema.parse(req.body)));
};
export const assignTicket: RequestHandler = async (req, res) => {
  res.json(await tickets.assignTicket(id(req), actor(req), assignSchema.parse(req.body)));
};
export const comments: RequestHandler = async (req, res) => {
  const detail = await tickets.getTicket(id(req), actor(req));
  res.json({ items: detail.comments });
};
export const addComment: RequestHandler = async (req, res) => {
  res
    .status(201)
    .json(await tickets.addComment(id(req), actor(req), commentSchema.parse(req.body)));
};
export const history: RequestHandler = async (req, res) => {
  const detail = await tickets.getTicket(id(req), actor(req));
  res.json({ items: detail.history });
};
export const resolveTicket: RequestHandler = async (req, res) => {
  res.json(await tickets.resolveTicket(id(req), actor(req), resolveSchema.parse(req.body ?? {})));
};
export const closeTicket: RequestHandler = async (req, res) => {
  res.json(await tickets.closeTicket(id(req), actor(req)));
};
export const dashboard: RequestHandler = async (req, res) => {
  res.json(await getDashboard(actor(req)));
};
const protectLastAdmin = async (id: string, changes: { role?: UserRole; isActive?: boolean }) => {
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) throw new AppError(404, 'USER_NOT_FOUND', 'Nie znaleziono użytkownika.');
  const losesAdmin =
    user.role === UserRole.ADMIN &&
    user.isActive &&
    ((changes.role !== undefined && changes.role !== UserRole.ADMIN) || changes.isActive === false);
  if (
    losesAdmin &&
    (await prisma.user.count({ where: { role: UserRole.ADMIN, isActive: true } })) <= 1
  )
    throw new AppError(409, 'LAST_ADMIN', 'Nie można zmienić ostatniego aktywnego administratora.');
  return user;
};
export const listUsers: RequestHandler = async (_req, res) => {
  res.json({
    items: (await prisma.user.findMany({ orderBy: { createdAt: 'desc' } })).map(publicUser),
  });
};
export const createUser: RequestHandler = async (req, res) => {
  const input = userCreateSchema.parse(req.body);
  const exists = await prisma.user.findUnique({ where: { email: input.email.toLowerCase() } });
  if (exists) throw new AppError(409, 'EMAIL_EXISTS', 'Użytkownik z tym e-mailem już istnieje.');
  const user = await prisma.user.create({
    data: {
      ...input,
      email: input.email.toLowerCase(),
      passwordHash: await bcrypt.hash(input.password, 12),
    },
  });
  res.status(201).json({ user: publicUser(user) });
};
export const patchUser: RequestHandler = async (req, res) => {
  const userId = id(req);
  await protectLastAdmin(userId, {});
  const input = userPatchSchema.parse(req.body);
  const data = { ...input, ...(input.email ? { email: input.email.toLowerCase() } : {}) };
  try {
    const user = await prisma.user.update({ where: { id: userId }, data });
    res.json({ user: publicUser(user) });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')
      throw new AppError(409, 'EMAIL_EXISTS', 'Użytkownik z tym e-mailem już istnieje.');
    throw error;
  }
};
export const changeRole: RequestHandler = async (req, res) => {
  const userId = id(req);
  const input = roleSchema.parse(req.body);
  await protectLastAdmin(userId, input);
  const user = await prisma.user.update({ where: { id: userId }, data: input });
  res.json({ user: publicUser(user) });
};
export const changeStatus: RequestHandler = async (req, res) => {
  const userId = id(req);
  const input = accountStatusSchema.parse(req.body);
  await protectLastAdmin(userId, input);
  const user = await prisma.user.update({ where: { id: userId }, data: input });
  res.json({ user: publicUser(user) });
};
