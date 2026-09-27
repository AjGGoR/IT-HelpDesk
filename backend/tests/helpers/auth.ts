import type { UserRole } from '@prisma/client';
import { signToken } from '../../src/middleware/auth.js';

export const authHeader = (user: { id: string; role: UserRole }): [string, string] => [
  'Authorization',
  `Bearer ${signToken({ userId: user.id, role: user.role })}`,
];
