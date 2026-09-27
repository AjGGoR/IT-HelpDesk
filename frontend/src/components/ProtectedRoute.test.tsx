import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import type { SessionUser } from '../types/auth';
import { ProtectedRoute } from './ProtectedRoute';

const mockUseAuth = vi.fn();
vi.mock('../context/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}));

const technicianUser: SessionUser = {
  id: 't1',
  email: 'tech@helpdesk.test',
  firstName: 'Anna',
  lastName: 'Nowak',
  role: 'TECHNICIAN',
  isActive: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

function renderWithRoute(initialPath: string, roles?: SessionUser['role'][]) {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/login" element={<div>Ekran logowania</div>} />
        <Route path="/dashboard" element={<div>Pulpit</div>} />
        <Route element={<ProtectedRoute roles={roles} />}>
          <Route path="/secure" element={<div>Treść chroniona</div>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe('ProtectedRoute', () => {
  it('shows a loading indicator while the session is being resolved', () => {
    mockUseAuth.mockReturnValue({ status: 'loading', user: null });
    renderWithRoute('/secure');
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('redirects to /login when unauthenticated', () => {
    mockUseAuth.mockReturnValue({ status: 'unauthenticated', user: null });
    renderWithRoute('/secure');
    expect(screen.getByText('Ekran logowania')).toBeInTheDocument();
  });

  it('renders the protected content when authenticated', () => {
    mockUseAuth.mockReturnValue({ status: 'authenticated', user: technicianUser });
    renderWithRoute('/secure');
    expect(screen.getByText('Treść chroniona')).toBeInTheDocument();
  });

  it('redirects to /dashboard when the user role is not allowed', () => {
    mockUseAuth.mockReturnValue({ status: 'authenticated', user: technicianUser });
    renderWithRoute('/secure', ['ADMIN']);
    expect(screen.getByText('Pulpit')).toBeInTheDocument();
  });
});
