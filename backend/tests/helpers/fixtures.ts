import { UserRole } from '@prisma/client';

export const makeUser = (overrides: Partial<Record<string, unknown>> = {}) => ({
  id: '00000000-0000-4000-8000-000000000000',
  email: 'fixture@helpdesk.test',
  passwordHash: 'hash',
  firstName: 'Fixture',
  lastName: 'User',
  role: UserRole.USER,
  isActive: true,
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-01T00:00:00Z'),
  ...overrides,
});

export const adminUser = makeUser({
  id: '11111111-1111-4111-8111-111111111111',
  email: 'admin@helpdesk.test',
  role: UserRole.ADMIN,
});
export const technicianUser = makeUser({
  id: '22222222-2222-4222-8222-222222222222',
  email: 'tech@helpdesk.test',
  role: UserRole.TECHNICIAN,
});
export const ownerUser = makeUser({
  id: '33333333-3333-4333-8333-333333333333',
  email: 'owner@helpdesk.test',
  role: UserRole.USER,
});
export const otherUser = makeUser({
  id: '44444444-4444-4444-8444-444444444444',
  email: 'other@helpdesk.test',
  role: UserRole.USER,
});

export const usersById = new Map(
  [adminUser, technicianUser, ownerUser, otherUser].map((user) => [user.id, user]),
);

export const makeTicket = (overrides: Partial<Record<string, unknown>> = {}) => ({
  id: '55555555-5555-4555-8555-555555555555',
  ticketNumber: 'HD-000001',
  title: 'Drukarka nie działa',
  description: 'Drukarka na piętrze nie drukuje od rana.',
  type: 'INCIDENT',
  category: 'HARDWARE',
  priority: 'MEDIUM',
  status: 'NEW',
  reporterId: ownerUser.id,
  assigneeId: null,
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-01T00:00:00Z'),
  resolvedAt: null,
  closedAt: null,
  slaDueAt: null,
  resolutionNote: null,
  reporter: {
    id: ownerUser.id,
    email: ownerUser.email,
    firstName: ownerUser.firstName,
    lastName: ownerUser.lastName,
    role: ownerUser.role,
    isActive: true,
  },
  assignee: null,
  ...overrides,
});
