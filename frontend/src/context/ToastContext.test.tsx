import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ToastProvider, useToast } from './ToastContext';

function Probe() {
  const { showToast } = useToast();
  return (
    <div>
      <button onClick={() => showToast('Zapisano zmiany.')}>show</button>
      <button onClick={() => showToast('Inna wiadomość.')}>show-other</button>
    </div>
  );
}

function renderToasts() {
  return render(
    <ToastProvider>
      <Probe />
    </ToastProvider>,
  );
}

describe('ToastProvider', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows a toast when showToast is called', async () => {
    const user = userEvent.setup({ delay: null });
    renderToasts();

    await user.click(screen.getByText('show'));

    expect(screen.getByText('Zapisano zmiany.')).toBeInTheDocument();
  });

  it('shows multiple toasts at once', async () => {
    const user = userEvent.setup({ delay: null });
    renderToasts();

    await user.click(screen.getByText('show'));
    await user.click(screen.getByText('show-other'));

    expect(screen.getByText('Zapisano zmiany.')).toBeInTheDocument();
    expect(screen.getByText('Inna wiadomość.')).toBeInTheDocument();
  });

  it('does not expose a status role while no toast is visible, to avoid colliding with page-level loading indicators', () => {
    renderToasts();

    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('exposes each visible toast as its own status role for screen readers', async () => {
    const user = userEvent.setup({ delay: null });
    renderToasts();

    await user.click(screen.getByText('show'));

    expect(screen.getByRole('status')).toHaveTextContent('Zapisano zmiany.');
  });

  it('automatically dismisses a toast after its duration', async () => {
    const user = userEvent.setup({ delay: null });
    renderToasts();

    await user.click(screen.getByText('show'));
    expect(screen.getByText('Zapisano zmiany.')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(4000);
    });

    expect(screen.queryByText('Zapisano zmiany.')).not.toBeInTheDocument();
  });
});
