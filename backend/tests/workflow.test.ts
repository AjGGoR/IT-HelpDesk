import { TicketStatus } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import { assertTransition } from '../src/services/ticket.service.js';

describe('ticket workflow', () => {
  it('accepts supported transitions', () => {
    expect(() => assertTransition(TicketStatus.NEW, TicketStatus.IN_PROGRESS)).not.toThrow();
    expect(() => assertTransition(TicketStatus.IN_PROGRESS, TicketStatus.RESOLVED)).not.toThrow();
    expect(() => assertTransition(TicketStatus.RESOLVED, TicketStatus.CLOSED)).not.toThrow();
  });
  it('rejects skipped and closed transitions', () => {
    expect(() => assertTransition(TicketStatus.NEW, TicketStatus.CLOSED)).toThrow();
    expect(() => assertTransition(TicketStatus.CLOSED, TicketStatus.IN_PROGRESS)).toThrow();
  });
});
