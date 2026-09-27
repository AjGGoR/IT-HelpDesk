import { vi } from 'vitest';
import { usersById } from './fixtures.js';

export const prismaMock = {
  user: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    count: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  ticket: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    count: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    groupBy: vi.fn(),
  },
  comment: { findMany: vi.fn(), create: vi.fn() },
  ticketHistory: { findMany: vi.fn(), create: vi.fn(), createMany: vi.fn() },
  $queryRaw: vi.fn(),
  $transaction: vi.fn(),
};

type MockFn = { mockReset: () => void };

export function resetPrismaMock() {
  for (const value of Object.values(prismaMock)) {
    if (typeof value === 'function') {
      (value as unknown as MockFn).mockReset();
      continue;
    }
    for (const fn of Object.values(value)) (fn as unknown as MockFn).mockReset();
  }
  prismaMock.$transaction.mockImplementation(async (arg: unknown) => {
    if (Array.isArray(arg)) return Promise.all(arg);
    if (typeof arg === 'function') return (arg as (tx: typeof prismaMock) => unknown)(prismaMock);
    throw new Error('Unsupported $transaction argument in test mock');
  });
  prismaMock.$queryRaw.mockResolvedValue([{ value: 1 }]);
  prismaMock.user.findUnique.mockImplementation(
    async ({ where }: { where: { id?: string; email?: string } }) => {
      if (where.id) return usersById.get(where.id) ?? null;
      return null;
    },
  );
}
