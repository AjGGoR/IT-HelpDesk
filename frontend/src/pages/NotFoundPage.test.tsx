import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { NotFoundPage } from './NotFoundPage';

describe('NotFoundPage', () => {
  it('sets the document title', () => {
    render(
      <MemoryRouter>
        <NotFoundPage />
      </MemoryRouter>,
    );

    expect(document.title).toBe('Nie znaleziono strony — HelpDesk');
    expect(screen.getByText('Nie znaleziono strony')).toBeInTheDocument();
  });
});
